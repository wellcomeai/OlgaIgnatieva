"""Каналы Telegram: разбор ссылки и проверка подписки.

getChatMember для канала работает, только если бот — администратор этого
канала. Закрытые каналы по ссылке-приглашению (t.me/+…) по ссылке не
определить — нужен публичный @username или числовой id (-100…).
"""
from __future__ import annotations

import logging
import re

from aiogram import Bot as TgBot
from aiogram.enums import ChatMemberStatus

from modules.bots.telegram import TelegramAPIError

logger = logging.getLogger(__name__)

_USERNAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{3,31}$")
_LINK_RE = re.compile(r"^(?:https?://)?(?:t\.me|telegram\.me)/(?:s/)?([A-Za-z0-9_]+)/?$", re.I)
_ID_RE = re.compile(r"^-100\d{5,15}$")


def parse_channel(value: str | None) -> str | int | None:
    """«https://t.me/name», «t.me/name», «@name», «name», «-100…» → chat_id для Bot API."""
    s = (value or "").strip()
    if not s:
        return None
    if _ID_RE.match(s):
        return int(s)
    m = _LINK_RE.match(s)
    if m:
        s = m.group(1)
    s = s.lstrip("@")
    return f"@{s}" if _USERNAME_RE.match(s) else None


SUBSCRIBED = {ChatMemberStatus.CREATOR, ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.MEMBER}


async def is_subscribed(tg: TgBot, channel: str | int, user_id: int) -> bool:
    """Подписан ли пользователь. Ошибка доступа (бот не админ и т.п.) — считаем «нет»."""
    try:
        member = await tg.get_chat_member(chat_id=channel, user_id=user_id)
    except TelegramAPIError as exc:
        logger.warning("getChatMember %s failed: %s", channel, exc.message)
        return False
    if member.status in SUBSCRIBED:
        return True
    return member.status == ChatMemberStatus.RESTRICTED and bool(getattr(member, "is_member", False))


async def check_access(tg: TgBot, channel_value: str, bot_tg_id: int) -> dict:
    """Для кнопки «Проверить доступ» в редакторе воронки."""
    channel = parse_channel(channel_value)
    if channel is None:
        return {"ok": False, "error": "Укажите ссылку вида https://t.me/имя_канала или @имя_канала"}
    try:
        chat = await tg.get_chat(chat_id=channel)
    except TelegramAPIError as exc:
        return {"ok": False, "error": f"Канал не найден: {exc.message}"}
    try:
        me = await tg.get_chat_member(chat_id=channel, user_id=bot_tg_id)
        is_admin = me.status in (ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.CREATOR)
    except TelegramAPIError:
        is_admin = False
    return {
        "ok": is_admin,
        "title": chat.title,
        "is_admin": is_admin,
        "error": None if is_admin else "Бот не администратор канала — проверить подписку он не сможет",
    }
