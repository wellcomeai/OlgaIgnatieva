"""Telegram через aiogram 3.

Все боты делят одну HTTP-сессию (сессия aiogram не привязана к токену),
объекты `aiogram.Bot` создаются на запрос и не закрываются по отдельности.
Сессия закрывается при остановке приложения (`close_session` в lifespan).
"""
from __future__ import annotations

import re

from aiogram import Bot as TgBot
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.client.session.base import BaseSession
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramAPIError

__all__ = ["TOKEN_RE", "TelegramAPIError", "close_session", "get_session", "make_bot"]

TOKEN_RE = re.compile(r"^\d{5,15}:[A-Za-z0-9_-]{30,50}$")

_session: BaseSession | None = None


def get_session() -> BaseSession:
    global _session
    if _session is None:
        _session = AiohttpSession()
    return _session


def make_bot(token: str) -> TgBot:
    return TgBot(
        token,
        session=get_session(),
        default=DefaultBotProperties(parse_mode=ParseMode.HTML, link_preview_is_disabled=True),
    )


async def close_session() -> None:
    global _session
    if _session is not None:
        await _session.close()
        _session = None
