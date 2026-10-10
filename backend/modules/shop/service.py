"""Продукты, файлы и заказы: операции кабинета."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Sequence

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from modules.app_settings.service import robokassa_config
from modules.auth.models import User
from modules.bots.models import Bot, Subscriber
from modules.shop import storage
from modules.shop.models import Order, OrderStatus, Product, ProductFile
from modules.shop.schemas import (
    OrderPublic,
    OrderStats,
    PaymentsConfig,
    ProductCreate,
    ProductUpdate,
)

BUY_PREFIX = "buy-"
MAX_FILES_PER_PRODUCT = 20


def buy_payload(product: Product) -> str:
    """start-параметр ссылки на покупку: buy-<uuid без дефисов> (36 символов)."""
    return f"{BUY_PREFIX}{product.id.hex}"


# ---- продукты ----------------------------------------------------------

async def get_product(db: AsyncSession, user: User, product_id: uuid.UUID) -> Product:
    product = await db.get(Product, product_id)
    if product is None or product.user_id != user.id:
        raise HTTPException(status_code=404, detail="Продукт не найден")
    return product


async def product_stats(
    db: AsyncSession, product_ids: list[uuid.UUID]
) -> tuple[dict[uuid.UUID, int], dict[uuid.UUID, tuple[int, Decimal]]]:
    if not product_ids:
        return {}, {}
    files = await db.execute(
        select(ProductFile.product_id, func.count())
        .where(ProductFile.product_id.in_(product_ids))
        .group_by(ProductFile.product_id)
    )
    sales = await db.execute(
        select(Order.product_id, func.count(), func.coalesce(func.sum(Order.amount), 0))
        .where(Order.product_id.in_(product_ids), Order.status == OrderStatus.PAID)
        .group_by(Order.product_id)
    )
    return (
        {pid: n for pid, n in files.all()},
        {pid: (n, Decimal(total)) for pid, n, total in sales.all()},
    )


async def list_products(db: AsyncSession, user: User) -> Sequence[Product]:
    return (
        await db.scalars(
            select(Product).where(Product.user_id == user.id).order_by(Product.created_at.desc())
        )
    ).all()


async def create_product(db: AsyncSession, user: User, payload: ProductCreate) -> Product:
    product = Product(
        user_id=user.id,
        title=payload.title.strip(),
        price=payload.price,
        description=payload.description,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def update_product(db: AsyncSession, product: Product, payload: ProductUpdate) -> Product:
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(product, field, value.strip() if field == "title" else value)
    await db.commit()
    await db.refresh(product)
    return product


async def delete_product(db: AsyncSession, product: Product) -> None:
    product_id = product.id
    # Убрать кнопку продукта из приветствий ботов
    bots = (await db.scalars(select(Bot).where(Bot.user_id == product.user_id))).all()
    for bot in bots:
        if str(product_id) in bot.welcome_product_ids:
            bot.welcome_product_ids = [p for p in bot.welcome_product_ids if p != str(product_id)]
    await db.delete(product)
    await db.commit()
    storage.delete_product_dir(product_id)


async def list_files(db: AsyncSession, product: Product) -> Sequence[ProductFile]:
    return (
        await db.scalars(
            select(ProductFile)
            .where(ProductFile.product_id == product.id)
            .order_by(ProductFile.position, ProductFile.created_at)
        )
    ).all()


async def add_file(db: AsyncSession, product: Product, upload: UploadFile) -> ProductFile:
    count = await db.scalar(
        select(func.count()).where(ProductFile.product_id == product.id)
    ) or 0
    if count >= MAX_FILES_PER_PRODUCT:
        raise HTTPException(status_code=422, detail=f"Не больше {MAX_FILES_PER_PRODUCT} файлов")
    storage_name, size = await storage.save_upload(product.id, upload)
    obj = ProductFile(
        product_id=product.id,
        filename=storage.safe_filename(upload.filename),
        content_type=(upload.content_type or "application/octet-stream")[:127],
        size=size,
        storage_name=storage_name,
        tg_file_ids={},
        position=count,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete_file(db: AsyncSession, product: Product, file_id: uuid.UUID) -> None:
    obj = await db.get(ProductFile, file_id)
    if obj is None or obj.product_id != product.id:
        raise HTTPException(status_code=404, detail="Файл не найден")
    storage_name = obj.storage_name
    await db.delete(obj)
    await db.commit()
    storage.delete_file(storage_name)


async def buy_links(db: AsyncSession, user: User, product: Product) -> list[str]:
    usernames = (
        await db.scalars(select(Bot.username).where(Bot.user_id == user.id).order_by(Bot.created_at))
    ).all()
    return [f"https://t.me/{u}?start={buy_payload(product)}" for u in usernames]


# ---- заказы ------------------------------------------------------------

async def list_orders(
    db: AsyncSession, user: User, status: str | None, limit: int, offset: int
) -> tuple[list[OrderPublic], int]:
    query = (
        select(Order, Bot.username, Subscriber.first_name, Subscriber.last_name, Subscriber.username)
        .outerjoin(Bot, Bot.id == Order.bot_id)
        .outerjoin(Subscriber, Subscriber.id == Order.subscriber_id)
        .where(Order.user_id == user.id)
    )
    if status:
        query = query.where(Order.status == status)
    total = await db.scalar(
        select(func.count()).select_from(
            select(Order.id)
            .where(Order.user_id == user.id, *([Order.status == status] if status else []))
            .subquery()
        )
    ) or 0
    rows = await db.execute(query.order_by(Order.created_at.desc()).limit(limit).offset(offset))
    items = []
    for order, bot_username, first, last, sub_username in rows.all():
        items.append(
            OrderPublic(
                id=order.id,
                inv_id=order.inv_id,
                product_id=order.product_id,
                product_title=order.product_title,
                amount=order.amount,
                status=order.status,
                paid_at=order.paid_at,
                delivered_at=order.delivered_at,
                delivery_error=order.delivery_error,
                created_at=order.created_at,
                bot_username=bot_username,
                subscriber_name=" ".join(p for p in (first, last) if p) or None,
                subscriber_username=sub_username,
            )
        )
    return items, total


async def order_stats(db: AsyncSession, user: User) -> OrderStats:
    since = datetime.now(timezone.utc) - timedelta(days=30)
    paid = (Order.user_id == user.id, Order.status == OrderStatus.PAID)
    total_n, total_sum = (
        await db.execute(select(func.count(), func.coalesce(func.sum(Order.amount), 0)).where(*paid))
    ).one()
    month_n, month_sum = (
        await db.execute(
            select(func.count(), func.coalesce(func.sum(Order.amount), 0)).where(
                *paid, Order.paid_at >= since
            )
        )
    ).one()
    return OrderStats(
        revenue=Decimal(total_sum),
        paid_count=total_n,
        revenue_30d=Decimal(month_sum),
        paid_count_30d=month_n,
    )


async def get_order(db: AsyncSession, user: User, order_id: uuid.UUID) -> Order:
    order = await db.get(Order, order_id)
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    return order


async def payments_config(db: AsyncSession) -> PaymentsConfig:
    base = settings.public_base_url
    app = settings.app_url.rstrip("/")
    cfg = await robokassa_config(db)
    return PaymentsConfig(
        robokassa_configured=cfg.configured,
        test_mode=cfg.test_mode,
        receipt_enabled=cfg.receipt_enabled,
        result_url=f"{base}/api/v1/webhooks/robokassa",
        success_url=f"{app}/pay/success",
        fail_url=f"{app}/pay/fail",
    )
