"""Pydantic схемы для shop."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Price = Annotated[Decimal, Field(ge=Decimal("1"), le=Decimal("1000000"), decimal_places=2)]


class ProductCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    price: Price
    description: str = Field(default="", max_length=3000)


class ProductUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    price: Price | None = None
    description: str | None = Field(default=None, max_length=3000)
    delivery_message: str | None = Field(default=None, min_length=1, max_length=4096)
    protect_content: bool | None = None
    is_active: bool | None = None


class ProductFilePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    content_type: str
    size: int
    created_at: datetime


class ProductPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    price: Decimal
    delivery_message: str
    protect_content: bool
    is_active: bool
    created_at: datetime
    files_count: int = 0
    sales_count: int = 0
    revenue: Decimal = Decimal("0")


class ProductDetail(ProductPublic):
    files: list[ProductFilePublic] = []
    # Ссылки t.me/<бот>?start=buy-<id> для каждого подключённого бота
    buy_links: list[str] = []


class OrderPublic(BaseModel):
    id: UUID
    inv_id: int
    product_id: UUID | None
    product_title: str
    amount: Decimal
    status: str
    paid_at: datetime | None
    delivered_at: datetime | None
    delivery_error: str | None
    created_at: datetime
    bot_username: str | None = None
    subscriber_name: str | None = None
    subscriber_username: str | None = None


class OrderPage(BaseModel):
    items: list[OrderPublic]
    total: int


class OrderStats(BaseModel):
    revenue: Decimal
    paid_count: int
    revenue_30d: Decimal
    paid_count_30d: int


class PaymentsConfig(BaseModel):
    robokassa_configured: bool
    test_mode: bool
    receipt_enabled: bool
    result_url: str
    success_url: str
    fail_url: str
