"""Вебхуки Telegram: сюда Telegram присылает апдейты всех подключённых ботов."""
from __future__ import annotations

import hmac
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from modules.bots import service as bots_service
from modules.bots.handlers import handle_update
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
    bot = await db.get(Bot, bot_id)
    if bot is None or not x_telegram_bot_api_secret_token or not hmac.compare_digest(
        x_telegram_bot_api_secret_token, bot.webhook_secret
    ):
        raise HTTPException(status_code=403, detail="Forbidden")
    if not bot.is_active:
        return {"ok": True}

    try:
        update = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Ошибка обработки не должна приводить к бесконечным повторам от Telegram:
    # логируем и всё равно отвечаем 200.
    try:
        await handle_update(db, bot, update)
    except Exception:
        logger.exception("Failed to handle update %s for bot %s", update.get("update_id"), bot.id)
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
