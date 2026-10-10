"""Общие хелперы тестов: подключение бота и сборка апдейтов Telegram."""
from __future__ import annotations

from typing import Any

from database import AsyncSessionLocal
from modules.bots.models import Bot

TOKEN = "7000001:AAH" + "x" * 32


async def connect_bot(client) -> dict:
    r = await client.post("/api/v1/bots", json={"token": TOKEN})
    assert r.status_code == 201, r.text
    return r.json()


async def bot_row(bot_id: str) -> Bot:
    async with AsyncSessionLocal() as db:
        return await db.get(Bot, bot_id)


async def secret_headers(bot_id: str) -> dict[str, str]:
    return {"X-Telegram-Bot-Api-Secret-Token": (await bot_row(bot_id)).webhook_secret}


def tg_user(user_id: int = 42, first_name: str = "Ольга") -> dict[str, Any]:
    return {"id": user_id, "is_bot": False, "first_name": first_name, "username": "olga"}


def message_update(text: str, user_id: int = 42, first_name: str = "Ольга") -> dict[str, Any]:
    entities = [{"type": "bot_command", "offset": 0, "length": len(text.split()[0])}] if text.startswith("/") else None
    msg: dict[str, Any] = {
        "message_id": 1,
        "date": 1_700_000_000,
        "chat": {"id": user_id, "type": "private"},
        "from": tg_user(user_id, first_name),
        "text": text,
    }
    if entities:
        msg["entities"] = entities
    return {"update_id": 1, "message": msg}


def callback_update(data: str, user_id: int = 42) -> dict[str, Any]:
    return {
        "update_id": 2,
        "callback_query": {
            "id": "cb-1",
            "from": tg_user(user_id),
            "chat_instance": "ci",
            "data": data,
            "message": {
                "message_id": 5,
                "date": 1_700_000_000,
                "chat": {"id": user_id, "type": "private"},
                "text": "welcome",
            },
        },
    }


async def send_update(client, bot_id: str, update: dict[str, Any]):
    r = await client.post(f"/api/v1/tg/{bot_id}", json=update, headers=await secret_headers(bot_id))
    assert r.status_code == 200, r.text
    return r
