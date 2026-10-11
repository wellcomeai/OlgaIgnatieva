"""Публичные данные сайта: лендинг и реквизиты для оферты (без авторизации)."""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from modules.app_settings.service import effective
from modules.bots.models import Bot
from modules.shop.models import Product
from modules.shop.service import buy_payload

router = APIRouter(prefix="/public", tags=["public"])


class Seller(BaseModel):
    status: str
    name: str
    inn: str
    ogrn: str
    address: str
    email: str
    phone: str


class LandingOffer(BaseModel):
    title: str
    price: Decimal
    buy_url: str


class SiteInfo(BaseModel):
    site_url: str
    seller: Seller
    offer: LandingOffer | None


def _uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        return None


@router.get("/site", response_model=SiteInfo)
async def site_info(db: Annotated[AsyncSession, Depends(get_db)]):
    v = await effective(db)
    offer = None
    product_id, bot_id = _uuid(v["landing_product_id"]), _uuid(v["landing_bot_id"])
    product = await db.get(Product, product_id) if product_id else None
    bot = await db.get(Bot, bot_id) if bot_id else None
    if product and bot and product.is_active and bot.is_active and product.user_id == bot.user_id:
        offer = LandingOffer(
            title=product.title,
            price=product.price,
            buy_url=f"https://t.me/{bot.username}?start={buy_payload(product)}",
        )
    return SiteInfo(
        site_url=settings.app_url.rstrip("/"),
        seller=Seller(
            status=v["seller_status"] or "self_employed",
            name=v["seller_name"],
            inn=v["seller_inn"],
            ogrn=v["seller_ogrn"],
            address=v["seller_address"],
            email=v["seller_email"],
            phone=v["seller_phone"],
        ),
        offer=offer,
    )
