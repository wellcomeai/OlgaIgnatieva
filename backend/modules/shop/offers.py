"""Продажа в боте: карточка продукта, заказ и ссылка на оплату."""
from __future__ import annotations

import html
import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from aiogram import Bot as TgBot
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.app_settings.service import RobokassaConfig, robokassa_config
from modules.billing import robokassa
from modules.bots.messaging import send_text
from modules.bots.models import Bot, Subscriber
from modules.shop.delivery import send_product
from modules.shop.models import Order, OrderStatus, Product
from modules.shop.service import BUY_PREFIX

logger = logging.getLogger(__name__)

PENDING_REUSE_WINDOW = timedelta(hours=24)


def format_price(value: Decimal) -> str:
    q = value.quantize(Decimal("0.01"))
    if q == q.to_integral_value():
        return f"{int(q):,}".replace(",", " ")
    return f"{q:,.2f}".replace(",", " ").replace(".", ",")


async def product_for_bot(db: AsyncSession, bot_row: Bot, product_id: uuid.UUID) -> Product | None:
    product = await db.get(Product, product_id)
    if product is None or product.user_id != bot_row.user_id or not product.is_active:
        return None
    return product


async def product_from_payload(db: AsyncSession, bot_row: Bot, payload: str) -> Product | None:
    """buy-<hex> из deep link → активный продукт владельца бота."""
    if not payload.startswith(BUY_PREFIX):
        return None
    try:
        product_id = uuid.UUID(hex=payload[len(BUY_PREFIX):])
    except ValueError:
        return None
    return await product_for_bot(db, bot_row, product_id)


def payment_url(cfg: RobokassaConfig, order: Order, bot_row: Bot) -> str:
    receipt = (
        robokassa.build_receipt(cfg, order.product_title, order.amount)
        if cfg.receipt_enabled
        else None
    )
    return robokassa.build_payment_url(
        cfg,
        inv_id=order.inv_id,
        amount=order.amount,
        description=order.product_title,
        shp={"Shp_bot": bot_row.username, "Shp_kind": "order"},
        receipt=receipt,
    )


async def _pending_order(
    db: AsyncSession, bot_row: Bot, subscriber: Subscriber, product: Product
) -> Order:
    """Переиспользуем свежий неоплаченный заказ, чтобы не плодить счета на каждое нажатие."""
    since = datetime.now(timezone.utc) - PENDING_REUSE_WINDOW
    order = await db.scalar(
        select(Order)
        .where(
            Order.subscriber_id == subscriber.id,
            Order.product_id == product.id,
            Order.status == OrderStatus.PENDING,
            Order.amount == product.price,
            Order.created_at >= since,
        )
        .order_by(Order.created_at.desc())
        .limit(1)
    )
    if order is None:
        order = Order(
            user_id=bot_row.user_id,
            bot_id=bot_row.id,
            subscriber_id=subscriber.id,
            product_id=product.id,
            product_title=product.title,
            amount=product.price,
            status=OrderStatus.PENDING,
        )
        db.add(order)
        await db.flush()  # получить inv_id
    return order


async def send_offer(
    tg: TgBot, db: AsyncSession, bot_row: Bot, subscriber: Subscriber, product: Product
) -> None:
    chat_id = subscriber.tg_user_id
    already_paid = await db.scalar(
        select(Order.id)
        .where(
            Order.subscriber_id == subscriber.id,
            Order.product_id == product.id,
            Order.status == OrderStatus.PAID,
        )
        .limit(1)
    )
    if already_paid:
        await send_text(
            tg,
            chat_id,
            f"Вы уже приобрели «{html.escape(product.title)}». Отправляю материалы ещё раз 👇",
        )
        await send_product(tg, db, bot_row, subscriber, product, with_message=False)
        return

    cfg = await robokassa_config(db)
    if not cfg.configured:
        logger.warning("Robokassa is not configured: offer for %s skipped", product.id)
        await send_text(tg, chat_id, "Оплата временно недоступна. Попробуйте, пожалуйста, позже.")
        return

    order = await _pending_order(db, bot_row, subscriber, product)
    await db.commit()  # заказ должен существовать до того, как человек нажмёт «Оплатить»

    price = format_price(order.amount)
    parts = [f"<b>{html.escape(product.title)}</b>"]
    if product.description.strip():
        parts.append(product.description.strip())
    parts.append(f"Стоимость: <b>{price} ₽</b>")
    markup = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=f"💳 Оплатить {price} ₽", url=payment_url(cfg, order, bot_row))]
        ]
    )
    await send_text(tg, chat_id, "\n\n".join(parts), reply_markup=markup)
