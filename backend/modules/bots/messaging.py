"""Отправка сообщений подписчикам: шаблоны и безопасный HTML."""
from __future__ import annotations

import html
from typing import Any

from aiogram import Bot as TgBot
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import Message

from modules.bots.models import Subscriber


def render_template(template: str, subscriber: Subscriber) -> str:
    """Подставить {first_name} / {username}; значения экранируются под parse_mode=HTML."""
    values = {
        "{first_name}": subscriber.first_name or "друг",
        "{username}": f"@{subscriber.username}" if subscriber.username else "",
    }
    for placeholder, value in values.items():
        template = template.replace(placeholder, html.escape(value))
    return template


async def send_text(tg: TgBot, chat_id: int, text: str, **kwargs: Any) -> Message:
    """sendMessage с HTML; если в тексте битая разметка — повтор обычным текстом."""
    try:
        return await tg.send_message(chat_id, text, **kwargs)
    except TelegramBadRequest as exc:
        if "parse entities" not in exc.message:
            raise
        return await tg.send_message(chat_id, text, parse_mode=None, **kwargs)
