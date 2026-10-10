"""Продукты, файлы и заказы (internal)."""
from __future__ import annotations

from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import CurrentUser
from modules.shop import delivery, service
from modules.shop.models import OrderStatus, Product
from modules.shop.schemas import (
    OrderPage,
    OrderStats,
    PaymentsConfig,
    ProductCreate,
    ProductDetail,
    ProductFilePublic,
    ProductPublic,
    ProductUpdate,
)

router = APIRouter(tags=["shop"])

Db = Annotated[AsyncSession, Depends(get_db)]


async def _detail(db: AsyncSession, user, product: Product) -> ProductDetail:
    files_count, sales = await service.product_stats(db, [product.id])
    n, revenue = sales.get(product.id, (0, Decimal("0")))
    files = await service.list_files(db, product)
    return ProductDetail.model_validate(product).model_copy(
        update={
            "files_count": files_count.get(product.id, 0),
            "sales_count": n,
            "revenue": revenue,
            "files": [ProductFilePublic.model_validate(f) for f in files],
            "buy_links": await service.buy_links(db, user, product),
        }
    )


@router.get("/products", response_model=list[ProductPublic])
async def list_products(user: CurrentUser, db: Db):
    products = await service.list_products(db, user)
    files_count, sales = await service.product_stats(db, [p.id for p in products])
    result = []
    for p in products:
        n, revenue = sales.get(p.id, (0, Decimal("0")))
        result.append(
            ProductPublic.model_validate(p).model_copy(
                update={"files_count": files_count.get(p.id, 0), "sales_count": n, "revenue": revenue}
            )
        )
    return result


@router.post("/products", response_model=ProductDetail, status_code=status.HTTP_201_CREATED)
async def create_product(payload: ProductCreate, user: CurrentUser, db: Db):
    product = await service.create_product(db, user, payload)
    return await _detail(db, user, product)


@router.get("/products/{product_id}", response_model=ProductDetail)
async def get_product(product_id: UUID, user: CurrentUser, db: Db):
    return await _detail(db, user, await service.get_product(db, user, product_id))


@router.patch("/products/{product_id}", response_model=ProductDetail)
async def update_product(product_id: UUID, payload: ProductUpdate, user: CurrentUser, db: Db):
    product = await service.get_product(db, user, product_id)
    product = await service.update_product(db, product, payload)
    return await _detail(db, user, product)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: UUID, user: CurrentUser, db: Db):
    await service.delete_product(db, await service.get_product(db, user, product_id))
    return None


@router.post(
    "/products/{product_id}/files",
    response_model=ProductFilePublic,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    product_id: UUID, user: CurrentUser, db: Db, file: Annotated[UploadFile, File()]
):
    product = await service.get_product(db, user, product_id)
    return ProductFilePublic.model_validate(await service.add_file(db, product, file))


@router.delete("/products/{product_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(product_id: UUID, file_id: UUID, user: CurrentUser, db: Db):
    product = await service.get_product(db, user, product_id)
    await service.delete_file(db, product, file_id)
    return None


@router.get("/orders", response_model=OrderPage)
async def list_orders(
    user: CurrentUser,
    db: Db,
    status_: str | None = Query(default=None, alias="status", pattern="^(pending|paid)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    items, total = await service.list_orders(db, user, status_, limit, offset)
    return OrderPage(items=items, total=total)


@router.get("/orders/stats", response_model=OrderStats)
async def order_stats(user: CurrentUser, db: Db):
    return await service.order_stats(db, user)


@router.post("/orders/{order_id}/deliver", status_code=status.HTTP_202_ACCEPTED)
async def redeliver_order(order_id: UUID, user: CurrentUser, db: Db, bg: BackgroundTasks):
    order = await service.get_order(db, user, order_id)
    if order.status != OrderStatus.PAID:
        raise HTTPException(status_code=400, detail="Заказ ещё не оплачен")
    bg.add_task(delivery.deliver_order, order.id)
    return {"ok": True}


@router.get("/payments/config", response_model=PaymentsConfig)
async def payments_config(user: CurrentUser, db: Db):
    return await service.payments_config(db)
