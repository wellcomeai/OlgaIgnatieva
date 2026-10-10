"""Управление Telegram-ботами (internal)."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import CurrentUser
from modules.bots import service as bots_service
from modules.bots.models import Bot
from modules.bots.schemas import (
    BotConnect,
    BotPublic,
    BotUpdate,
    SourceStat,
    SubscriberPage,
    SubscriberPublic,
    WebhookInfo,
)

router = APIRouter(prefix="/bots", tags=["bots"])

Db = Annotated[AsyncSession, Depends(get_db)]


def _public(bot: Bot, subscribers_count: int) -> BotPublic:
    return BotPublic.model_validate(bot).model_copy(
        update={"subscribers_count": subscribers_count}
    )


@router.get("", response_model=list[BotPublic])
async def list_bots(user: CurrentUser, db: Db):
    return [_public(b, n) for b, n in await bots_service.list_bots(db, user)]


@router.post("", response_model=BotPublic, status_code=status.HTTP_201_CREATED)
async def connect_bot(payload: BotConnect, user: CurrentUser, db: Db):
    bot = await bots_service.connect_bot(db, user, payload.token)
    return _public(bot, 0)


@router.get("/{bot_id}", response_model=BotPublic)
async def get_bot(bot_id: UUID, user: CurrentUser, db: Db):
    bot = await bots_service.get_bot(db, user, bot_id)
    return _public(bot, await bots_service.count_subscribers(db, bot))


@router.patch("/{bot_id}", response_model=BotPublic)
async def update_bot(bot_id: UUID, payload: BotUpdate, user: CurrentUser, db: Db):
    bot = await bots_service.get_bot(db, user, bot_id)
    bot = await bots_service.update_bot(db, bot, payload)
    return _public(bot, await bots_service.count_subscribers(db, bot))


@router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bot(bot_id: UUID, user: CurrentUser, db: Db):
    bot = await bots_service.get_bot(db, user, bot_id)
    await bots_service.delete_bot(db, bot)
    return None


@router.post("/{bot_id}/webhook", response_model=BotPublic)
async def refresh_webhook(bot_id: UUID, user: CurrentUser, db: Db):
    bot = await bots_service.get_bot(db, user, bot_id)
    bot = await bots_service.refresh_webhook(db, bot)
    return _public(bot, await bots_service.count_subscribers(db, bot))


@router.get("/{bot_id}/webhook", response_model=WebhookInfo)
async def webhook_info(bot_id: UUID, user: CurrentUser, db: Db):
    bot = await bots_service.get_bot(db, user, bot_id)
    return await bots_service.webhook_info(bot)


@router.get("/{bot_id}/subscribers", response_model=SubscriberPage)
async def list_subscribers(
    bot_id: UUID,
    user: CurrentUser,
    db: Db,
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    bot = await bots_service.get_bot(db, user, bot_id)
    items, total = await bots_service.list_subscribers(db, bot, search, limit, offset)
    return SubscriberPage(
        items=[SubscriberPublic.model_validate(s) for s in items], total=total
    )


@router.get("/{bot_id}/sources", response_model=list[SourceStat])
async def source_stats(bot_id: UUID, user: CurrentUser, db: Db):
    bot = await bots_service.get_bot(db, user, bot_id)
    return await bots_service.source_stats(db, bot)
