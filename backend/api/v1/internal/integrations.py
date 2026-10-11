"""Настройки интеграций из кабинета (только владелец)."""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import AdminUser
from modules.app_settings import service as app_settings
from modules.shop import service as shop_service

router = APIRouter(prefix="/settings/integrations", tags=["settings"])

Db = Annotated[AsyncSession, Depends(get_db)]


class IntegrationsUpdate(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)
    # Поля, которые нужно вернуть к значению из .env
    reset: list[str] = Field(default_factory=list)


async def _state(db: AsyncSession) -> dict[str, Any]:
    return {
        **{group: await app_settings.describe(db, group) for group in app_settings.GROUPS},
        "urls": (await shop_service.payments_config(db)).model_dump(),
    }


@router.get("")
async def get_integrations(user: AdminUser, db: Db):
    return await _state(db)


@router.put("")
async def update_integrations(payload: IntegrationsUpdate, user: AdminUser, db: Db):
    await app_settings.update(db, payload.values, payload.reset)
    return await _state(db)
