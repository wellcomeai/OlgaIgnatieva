"""Бизнес-логика ботов: подключение, вебхук, подписчики."""
from __future__ import annotations

import logging
import secrets
import time
from typing import Sequence
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from modules.auth.models import User
from aiogram import Bot as TgBot
from aiogram.exceptions import TelegramNotFound, TelegramUnauthorizedError

from modules.bots.crypto import decrypt_token, encrypt_token
from modules.bots.models import Bot, Subscriber, WebhookStatus
from modules.bots.schemas import BotUpdate, SourceStat, WebhookInfo
from modules.bots.telegram import TOKEN_RE, TelegramAPIError, make_bot
from modules.shop.models import Product

logger = logging.getLogger(__name__)

ALLOWED_UPDATES = ["message", "callback_query", "my_chat_member"]


def bot_token(bot: Bot) -> str:
    return decrypt_token(bot.token_encrypted)


def tg_bot(bot: Bot) -> TgBot:
    """aiogram-клиент для сохранённого бота."""
    return make_bot(bot_token(bot))


def webhook_url(bot: Bot) -> str:
    return f"{settings.telegram_webhook_base}/api/v1/tg/{bot.id}"


async def setup_webhook(bot: Bot) -> None:
    """Зарегистрировать вебхук в Telegram и записать результат в bot.webhook_*."""
    if not settings.telegram_webhook_base.startswith("https://"):
        bot.webhook_status = WebhookStatus.NO_HTTPS
        bot.webhook_error = (
            "Telegram принимает вебхуки только на https://. Укажите публичный "
            "адрес в TELEGRAM_WEBHOOK_BASE_URL (или APP_URL) и переподключите."
        )
        return
    try:
        await tg_bot(bot).set_webhook(
            url=webhook_url(bot),
            secret_token=bot.webhook_secret,
            allowed_updates=ALLOWED_UPDATES,
        )
    except TelegramAPIError as exc:
        bot.webhook_status = WebhookStatus.ERROR
        bot.webhook_error = exc.message
        return
    bot.webhook_status = WebhookStatus.OK
    bot.webhook_error = None


async def _remove_webhook(bot: Bot) -> None:
    try:
        await tg_bot(bot).delete_webhook()
    except TelegramAPIError as exc:
        logger.warning("deleteWebhook failed for bot %s: %s", bot.id, exc.message)


async def connect_bot(db: AsyncSession, user: User, token: str) -> Bot:
    token = token.strip()
    if not TOKEN_RE.match(token):
        raise HTTPException(
            status_code=422,
            detail="Неверный формат токена. Он выглядит так: 123456789:AAH...",
        )
    try:
        me = await make_bot(token).get_me()
    except (TelegramUnauthorizedError, TelegramNotFound) as exc:
        raise HTTPException(
            status_code=400,
            detail="Telegram не принял токен. Скопируйте его из @BotFather ещё раз.",
        ) from exc
    except TelegramAPIError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc

    existing = await db.scalar(select(Bot).where(Bot.tg_bot_id == me.id))
    if existing is not None:
        raise HTTPException(status_code=409, detail=f"Бот @{me.username} уже подключён")

    bot = Bot(
        user_id=user.id,
        tg_bot_id=me.id,
        username=me.username or str(me.id),
        first_name=me.first_name or me.username or str(me.id),
        token_encrypted=encrypt_token(token),
        webhook_secret=secrets.token_urlsafe(32),
        welcome_buttons=[],
        welcome_product_ids=[],
    )
    db.add(bot)
    await db.flush()  # нужен bot.id для URL вебхука
    await setup_webhook(bot)
    await db.commit()
    await db.refresh(bot)
    return bot


async def _subscriber_counts(db: AsyncSession, bot_ids: list[UUID]) -> dict[UUID, int]:
    if not bot_ids:
        return {}
    rows = await db.execute(
        select(Subscriber.bot_id, func.count())
        .where(Subscriber.bot_id.in_(bot_ids))
        .group_by(Subscriber.bot_id)
    )
    return {bot_id: count for bot_id, count in rows.all()}


async def list_bots(db: AsyncSession, user: User) -> list[tuple[Bot, int]]:
    bots = (
        await db.scalars(
            select(Bot).where(Bot.user_id == user.id).order_by(Bot.created_at.desc())
        )
    ).all()
    counts = await _subscriber_counts(db, [b.id for b in bots])
    return [(b, counts.get(b.id, 0)) for b in bots]


async def get_bot(db: AsyncSession, user: User, bot_id: UUID) -> Bot:
    bot = await db.get(Bot, bot_id)
    if bot is None or bot.user_id != user.id:
        raise HTTPException(status_code=404, detail="Бот не найден")
    return bot


async def count_subscribers(db: AsyncSession, bot: Bot) -> int:
    return (await _subscriber_counts(db, [bot.id])).get(bot.id, 0)


async def update_bot(db: AsyncSession, bot: Bot, payload: BotUpdate) -> Bot:
    if payload.welcome_text is not None:
        bot.welcome_text = payload.welcome_text
    if payload.welcome_buttons is not None:
        bot.welcome_buttons = [b.model_dump() for b in payload.welcome_buttons]
    if payload.welcome_product_ids is not None:
        ids = list(dict.fromkeys(payload.welcome_product_ids))
        found = set(
            (
                await db.scalars(
                    select(Product.id).where(Product.id.in_(ids), Product.user_id == bot.user_id)
                )
            ).all()
        )
        if len(found) != len(ids):
            raise HTTPException(status_code=422, detail="Продукт не найден")
        bot.welcome_product_ids = [str(i) for i in ids]
    if payload.is_active is not None and payload.is_active != bot.is_active:
        bot.is_active = payload.is_active
        if bot.is_active:
            await setup_webhook(bot)
        else:
            await _remove_webhook(bot)
            bot.webhook_status = WebhookStatus.DISABLED
            bot.webhook_error = None
    await db.commit()
    await db.refresh(bot)
    return bot


async def refresh_webhook(db: AsyncSession, bot: Bot) -> Bot:
    if not bot.is_active:
        raise HTTPException(status_code=400, detail="Сначала включите бота")
    await setup_webhook(bot)
    await db.commit()
    await db.refresh(bot)
    return bot


async def webhook_info(bot: Bot) -> WebhookInfo:
    try:
        info = await tg_bot(bot).get_webhook_info()
    except TelegramAPIError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
    return WebhookInfo(
        url_set=info.url == webhook_url(bot),
        pending_update_count=info.pending_update_count,
        last_error_message=info.last_error_message,
        last_error_date=info.last_error_date,
    )


async def delete_bot(db: AsyncSession, bot: Bot) -> None:
    await _remove_webhook(bot)
    _avatar_cache.pop(bot.id, None)
    await db.delete(bot)
    await db.commit()


async def list_subscribers(
    db: AsyncSession, bot: Bot, search: str | None, limit: int, offset: int
) -> tuple[Sequence[Subscriber], int]:
    query = select(Subscriber).where(Subscriber.bot_id == bot.id)
    if search:
        like = f"%{search.strip().lstrip('@')}%"
        query = query.where(
            or_(
                Subscriber.username.ilike(like),
                Subscriber.first_name.ilike(like),
                Subscriber.last_name.ilike(like),
                Subscriber.source.ilike(like),
            )
        )
    total = await db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = (
        await db.scalars(
            query.order_by(Subscriber.created_at.desc()).limit(limit).offset(offset)
        )
    ).all()
    return items, total


async def source_stats(db: AsyncSession, bot: Bot) -> list[SourceStat]:
    rows = await db.execute(
        select(Subscriber.source, func.count())
        .where(Subscriber.bot_id == bot.id)
        .group_by(Subscriber.source)
        .order_by(func.count().desc())
    )
    return [SourceStat(source=s, count=c) for s, c in rows.all()]


# ---- Аватар бота -------------------------------------------------------
# URL файла Telegram содержит токен, поэтому фото проксируем через бэкенд.

_AVATAR_TTL = 3600
_avatar_cache: dict[UUID, tuple[float, bytes | None]] = {}


async def get_avatar(bot: Bot) -> bytes | None:
    cached = _avatar_cache.get(bot.id)
    if cached and time.monotonic() - cached[0] < _AVATAR_TTL:
        return cached[1]
    data: bytes | None = None
    tg = tg_bot(bot)
    try:
        photos = await tg.get_user_profile_photos(user_id=bot.tg_bot_id, limit=1)
        if photos.photos:
            smallest = photos.photos[0][0]
            buf = await tg.download(smallest.file_id)
            data = buf.read() if buf else None
    except TelegramAPIError as exc:
        logger.info("avatar fetch failed for bot %s: %s", bot.id, exc.message)
        return None  # не кешируем сетевые ошибки
    _avatar_cache[bot.id] = (time.monotonic(), data)
    return data
