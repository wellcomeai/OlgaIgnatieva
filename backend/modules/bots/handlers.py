"""Обработка апдейтов Telegram, пришедших на вебхук бота."""
from __future__ import annotations

import html
import logging
import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.bots import telegram
from modules.bots.models import Bot, Subscriber
from modules.bots.service import bot_token

logger = logging.getLogger(__name__)

# Telegram разрешает в deep-link параметре только эти символы, до 64 штук
START_PARAM_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def parse_start(text: str) -> tuple[bool, str | None]:
    """'/start' или '/start@bot payload' → (is_start, payload)."""
    parts = text.strip().split(maxsplit=1)
    if not parts or parts[0].split("@", 1)[0] != "/start":
        return False, None
    payload = parts[1].strip() if len(parts) > 1 else None
    if payload and not START_PARAM_RE.match(payload):
        payload = None
    return True, payload


def render_welcome(template: str, subscriber: Subscriber) -> str:
    """Подставить {first_name} / {username}; значения экранируются под parse_mode=HTML."""
    values = {
        "{first_name}": subscriber.first_name or "друг",
        "{username}": f"@{subscriber.username}" if subscriber.username else "",
    }
    for placeholder, value in values.items():
        template = template.replace(placeholder, html.escape(value))
    return template


def welcome_markup(bot: Bot) -> dict[str, Any] | None:
    if not bot.welcome_buttons:
        return None
    return {
        "inline_keyboard": [[{"text": b["text"], "url": b["url"]}] for b in bot.welcome_buttons]
    }


async def upsert_subscriber(
    db: AsyncSession, bot: Bot, tg_user: dict[str, Any]
) -> tuple[Subscriber, bool]:
    sub = await db.scalar(
        select(Subscriber).where(
            Subscriber.bot_id == bot.id, Subscriber.tg_user_id == tg_user["id"]
        )
    )
    created = sub is None
    if created:
        sub = Subscriber(bot_id=bot.id, tg_user_id=tg_user["id"])
        db.add(sub)
    sub.username = tg_user.get("username")
    sub.first_name = tg_user.get("first_name")
    sub.last_name = tg_user.get("last_name")
    sub.language_code = tg_user.get("language_code")
    sub.last_seen_at = datetime.now(timezone.utc)
    return sub, created


async def send_welcome(bot: Bot, subscriber: Subscriber) -> None:
    params: dict[str, Any] = {
        "chat_id": subscriber.tg_user_id,
        "text": render_welcome(bot.welcome_text, subscriber),
        "reply_markup": welcome_markup(bot),
        "link_preview_options": {"is_disabled": True},
    }
    token = bot_token(bot)
    try:
        await telegram.call(token, "sendMessage", parse_mode="HTML", **params)
    except telegram.TelegramError as exc:
        if exc.error_code == 400 and "parse entities" in exc.description:
            # В тексте незакрытый HTML-тег — отправляем как обычный текст
            await telegram.call(token, "sendMessage", **params)
        elif exc.error_code == 403:
            subscriber.is_blocked = True
        else:
            raise


async def handle_update(db: AsyncSession, bot: Bot, update: dict[str, Any]) -> None:
    bot.last_update_at = datetime.now(timezone.utc)

    member = update.get("my_chat_member")
    if member and member.get("chat", {}).get("type") == "private":
        sub, _ = await upsert_subscriber(db, bot, member["from"])
        status = member.get("new_chat_member", {}).get("status")
        sub.is_blocked = status == "kicked"

    message = update.get("message")
    if message and message.get("chat", {}).get("type") == "private" and "from" in message:
        sub, created = await upsert_subscriber(db, bot, message["from"])
        sub.is_blocked = False
        is_start, payload = parse_start(message.get("text") or "")
        if is_start:
            if created and payload:
                sub.source = payload
            await db.flush()
            await send_welcome(bot, sub)

    await db.commit()
