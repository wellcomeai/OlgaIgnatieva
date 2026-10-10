"""Выдача купленных продуктов в Telegram и обработка оплаты."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from aiogram import Bot as TgBot
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError
from aiogram.types import FSInputFile
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from modules.bots.messaging import render_template, send_text
from modules.bots.models import Bot, Subscriber
from modules.bots.service import tg_bot
from modules.bots.telegram import TelegramAPIError
from modules.shop import storage
from modules.shop.models import Order, OrderStatus, Product, ProductFile

logger = logging.getLogger(__name__)


async def send_product(
    tg: TgBot,
    db: AsyncSession,
    bot_row: Bot,
    subscriber: Subscriber,
    product: Product,
    *,
    with_message: bool = True,
) -> None:
    """Отправить сообщение после покупки и все файлы продукта.

    file_id, полученный при первой отправке, кешируется на бота — дальше
    файл уходит мгновенно, без повторной загрузки.
    """
    chat_id = subscriber.tg_user_id
    if with_message:
        await send_text(
            tg,
            chat_id,
            render_template(product.delivery_message, subscriber),
            protect_content=product.protect_content,
        )
    files = (
        await db.scalars(
            select(ProductFile)
            .where(ProductFile.product_id == product.id)
            .order_by(ProductFile.position, ProductFile.created_at)
        )
    ).all()
    key = str(bot_row.id)
    for f in files:
        cached = f.tg_file_ids.get(key)
        upload = FSInputFile(storage.file_path(f.storage_name), filename=f.filename)
        try:
            msg = await tg.send_document(
                chat_id, document=cached or upload, protect_content=product.protect_content
            )
        except TelegramBadRequest:
            if not cached:
                raise
            # file_id протух (например, бот пересоздан) — загружаем заново
            cached = None
            msg = await tg.send_document(
                chat_id, document=upload, protect_content=product.protect_content
            )
        if not cached and msg.document:
            f.tg_file_ids = {**f.tg_file_ids, key: msg.document.file_id}
    await db.flush()


async def mark_paid(db: AsyncSession, inv_id: str, out_sum: str) -> tuple[Order, bool]:
    """Отметить заказ оплаченным (Result URL Робокассы). Идемпотентно.

    Возвращает (заказ, оплачен_только_что).
    """
    try:
        inv = int(inv_id)
        amount = Decimal(out_sum)
    except (ValueError, InvalidOperation) as exc:
        raise HTTPException(status_code=400, detail="Bad InvId/OutSum") from exc

    order = await db.scalar(select(Order).where(Order.inv_id == inv).with_for_update())
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if amount != order.amount:
        logger.error("Robokassa amount mismatch for order %s: %s != %s", inv, amount, order.amount)
        raise HTTPException(status_code=400, detail="Amount mismatch")
    if order.status == OrderStatus.PAID:
        return order, False
    order.status = OrderStatus.PAID
    order.paid_at = datetime.now(timezone.utc)
    await db.commit()
    return order, True


async def deliver_order(order_id: uuid.UUID) -> None:
    """Фоновая выдача оплаченного заказа (своя сессия БД)."""
    async with AsyncSessionLocal() as db:
        order = await db.get(Order, order_id)
        if order is None or order.status != OrderStatus.PAID:
            return
        bot_row = await db.get(Bot, order.bot_id) if order.bot_id else None
        subscriber = await db.get(Subscriber, order.subscriber_id) if order.subscriber_id else None
        product = await db.get(Product, order.product_id) if order.product_id else None
        if bot_row is None or subscriber is None or product is None:
            order.delivery_error = "Бот, подписчик или продукт удалены — выдать заказ нельзя"
            await db.commit()
            return
        try:
            await send_product(tg_bot(bot_row), db, bot_row, subscriber, product)
        except TelegramForbiddenError:
            subscriber.is_blocked = True
            order.delivery_error = "Подписчик заблокировал бота"
        except (TelegramAPIError, OSError) as exc:
            logger.exception("Delivery failed for order %s", order.inv_id)
            order.delivery_error = getattr(exc, "message", None) or str(exc)
        else:
            order.delivered_at = datetime.now(timezone.utc)
            order.delivery_error = None
            await _start_purchase_flows(db, bot_row, subscriber, product)
        await db.commit()


async def _start_purchase_flows(db: AsyncSession, bot_row: Bot, subscriber: Subscriber, product: Product) -> None:
    """Воронки с триггером «после оплаты этого продукта»."""
    from modules.flows import engine as flows

    tg = tg_bot(bot_row)
    for flow in await flows.flows_for_purchase(db, bot_row, product.id):
        await flows.start_flow(tg, db, bot_row, subscriber, flow)
