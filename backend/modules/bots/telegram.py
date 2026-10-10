"""Минимальный async-клиент Telegram Bot API поверх httpx."""
from __future__ import annotations

import logging
import re
from typing import Any

import httpx

# httpx на уровне INFO пишет URL запроса, а в URL Bot API лежит токен
logging.getLogger("httpx").setLevel(logging.WARNING)

API_BASE = "https://api.telegram.org"
TOKEN_RE = re.compile(r"^\d{5,15}:[A-Za-z0-9_-]{30,50}$")


class TelegramError(Exception):
    def __init__(self, description: str, error_code: int | None = None):
        super().__init__(description)
        self.description = description
        self.error_code = error_code


async def call(token: str, method: str, **params: Any) -> Any:
    """Вызвать метод Bot API. Бросает TelegramError при ok=false или сетевой ошибке."""
    payload = {k: v for k, v in params.items() if v is not None}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{API_BASE}/bot{token}/{method}", json=payload)
    except httpx.HTTPError as exc:
        raise TelegramError(f"Telegram недоступен ({exc.__class__.__name__})") from exc

    try:
        data = resp.json()
    except ValueError as exc:
        raise TelegramError(f"Некорректный ответ Telegram (HTTP {resp.status_code})") from exc

    if not data.get("ok"):
        raise TelegramError(
            data.get("description", "Неизвестная ошибка Telegram"), data.get("error_code")
        )
    return data["result"]


async def download_file(token: str, file_path: str) -> bytes:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{API_BASE}/file/bot{token}/{file_path}")
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise TelegramError(f"Не удалось скачать файл ({exc.__class__.__name__})") from exc
    return resp.content
