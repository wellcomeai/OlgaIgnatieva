"""Обработка апдейтов Telegram на aiogram 3.

Один Dispatcher обслуживает всех ботов: эндпоинт вебхука вызывает
`dispatcher.feed_update(tg_bot, update, db=..., bot_row=...)`, и хендлеры
получают сессию БД и строку бота как аргументы.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone

from aiogram import Bot as TgBot, Dispatcher, F, Router
from aiogram.enums import ChatMemberStatus, ChatType
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import (
    CallbackQuery,
    ChatMemberUpdated,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    User as TgUser,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.bots.messaging import render_template, send_text
from modules.bots.models import Bot, Subscriber
from modules.bots.telegram import TelegramAPIError
from modules.shop import offers
from modules.shop.models import Product

logger = logging.getLogger(__name__)

# Telegram разрешает в deep-link параметре только эти символы, до 64 штук
START_PARAM_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
BUY_CALLBACK = "buy:"

router = Router(name="bots")
router.message.filter(F.chat.type == ChatType.PRIVATE)
router.my_chat_member.filter(F.chat.type == ChatType.PRIVATE)

dispatcher = Dispatcher()
dispatcher.include_router(router)


def start_payload(command: CommandObject | None) -> str | None:
    args = (command.args or "").strip() if command else ""
    return args if START_PARAM_RE.match(args) else None


async def upsert_subscriber(
    db: AsyncSession, bot_row: Bot, tg_user: TgUser
) -> tuple[Subscriber, bool]:
    sub = await db.scalar(
        select(Subscriber).where(
            Subscriber.bot_id == bot_row.id, Subscriber.tg_user_id == tg_user.id
        )
    )
    created = sub is None
    if created:
        sub = Subscriber(bot_id=bot_row.id, tg_user_id=tg_user.id)
        db.add(sub)
    sub.username = tg_user.username
    sub.first_name = tg_user.first_name
    sub.last_name = tg_user.last_name
    sub.language_code = tg_user.language_code
    sub.last_seen_at = datetime.now(timezone.utc)
    return sub, created


async def welcome_markup(db: AsyncSession, bot_row: Bot) -> InlineKeyboardMarkup | None:
    rows: list[list[InlineKeyboardButton]] = []
    if bot_row.welcome_product_ids:
        ids = [uuid.UUID(p) for p in bot_row.welcome_product_ids]
        products = {
            p.id: p
            for p in (
                await db.scalars(
                    select(Product).where(
                        Product.id.in_(ids),
                        Product.user_id == bot_row.user_id,
                        Product.is_active.is_(True),
                    )
                )
            ).all()
        }
        for pid in ids:  # порядок, заданный владельцем
            if product := products.get(pid):
                rows.append(
                    [
                        InlineKeyboardButton(
                            text=f"🛒 {product.title} — {offers.format_price(product.price)} ₽",
                            callback_data=f"{BUY_CALLBACK}{product.id}",
                        )
                    ]
                )
    rows += [[InlineKeyboardButton(text=b["text"], url=b["url"])] for b in bot_row.welcome_buttons]
    return InlineKeyboardMarkup(inline_keyboard=rows) if rows else None


async def send_welcome(tg: TgBot, db: AsyncSession, bot_row: Bot, subscriber: Subscriber) -> None:
    await send_text(
        tg,
        subscriber.tg_user_id,
        render_template(bot_row.welcome_text, subscriber),
        reply_markup=await welcome_markup(db, bot_row),
    )


@router.message(CommandStart())
async def on_start(
    message: Message, command: CommandObject, bot: TgBot, db: AsyncSession, bot_row: Bot
) -> None:
    sub, created = await upsert_subscriber(db, bot_row, message.from_user)
    sub.is_blocked = False
    payload = start_payload(command)
    if created and payload:
        sub.source = payload
    await db.flush()

    product = await offers.product_from_payload(db, bot_row, payload) if payload else None
    if product is not None:
        await offers.send_offer(bot, db, bot_row, sub, product)
    else:
        await send_welcome(bot, db, bot_row, sub)


@router.callback_query(F.data.startswith(BUY_CALLBACK))
async def on_buy(callback: CallbackQuery, bot: TgBot, db: AsyncSession, bot_row: Bot) -> None:
    try:
        await callback.answer()  # убрать «часики» на кнопке; сбой не должен мешать покупке
    except TelegramAPIError as exc:
        logger.warning("answerCallbackQuery failed: %s", exc.message)
    try:
        product_id = uuid.UUID(callback.data[len(BUY_CALLBACK):])
    except ValueError:
        return
    sub, _ = await upsert_subscriber(db, bot_row, callback.from_user)
    sub.is_blocked = False
    await db.flush()
    product = await offers.product_for_bot(db, bot_row, product_id)
    if product is None:
        await send_text(bot, sub.tg_user_id, "Этот продукт больше недоступен.")
        return
    await offers.send_offer(bot, db, bot_row, sub, product)


@router.my_chat_member()
async def on_chat_member(event: ChatMemberUpdated, db: AsyncSession, bot_row: Bot) -> None:
    sub, _ = await upsert_subscriber(db, bot_row, event.from_user)
    sub.is_blocked = event.new_chat_member.status == ChatMemberStatus.KICKED


@router.message()
async def on_any_message(message: Message, db: AsyncSession, bot_row: Bot) -> None:
    if message.from_user:
        sub, _ = await upsert_subscriber(db, bot_row, message.from_user)
        sub.is_blocked = False
