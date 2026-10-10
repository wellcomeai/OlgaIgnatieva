"""Вебхуки Telegram: сюда Telegram присылает апдейты всех подключённых ботов."""
from __future__ import annotations

import hmac
import logging
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from aiogram.types import Update
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from modules.bots import service as bots_service
from modules.bots.handlers import dispatcher
from modules.bots.models import Bot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tg", tags=["telegram"])


@router.post("/{bot_id}")
async def telegram_webhook(
    bot_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_telegram_bot_api_secret_token: Annotated[str | None, Header()] = None,
):
    bot_row = await db.get(Bot, bot_id)
    if bot_row is None or not x_telegram_bot_api_secret_token or not hmac.compare_digest(
        x_telegram_bot_api_secret_token, bot_row.webhook_secret
    ):
        raise HTTPException(status_code=403, detail="Forbidden")
    if not bot_row.is_active:
        return {"ok": True}

    tg = bots_service.tg_bot(bot_row)
    try:
        update = Update.model_validate(await request.json(), context={"bot": tg})
    except (ValueError, ValidationError):
        raise HTTPException(status_code=400, detail="Invalid update")

    # Ошибка обработки не должна приводить к бесконечным повторам от Telegram:
    # логируем и всё равно отвечаем 200.
    bot_row.last_update_at = datetime.now(timezone.utc)
    try:
        await dispatcher.feed_update(tg, update, db=db, bot_row=bot_row)
        await db.commit()
    except Exception:
        logger.exception("Failed to handle update %s for bot %s", update.update_id, bot_row.id)
        await db.rollback()
    return {"ok": True}


@router.get("/{bot_id}/avatar")
async def bot_avatar(bot_id: UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    """Аватар бота (публичная информация, проксируется, чтобы не светить токен)."""
    bot = await db.get(Bot, bot_id)
    data = await bots_service.get_avatar(bot) if bot else None
    if not data:
        raise HTTPException(status_code=404, detail="No avatar")
    return Response(
        content=data,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )
