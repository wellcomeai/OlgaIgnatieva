from __future__ import annotations

import pytest
from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from modules.bots.crypto import decrypt_token
from modules.bots.handlers import parse_start, render_welcome
from modules.bots.models import Bot, Subscriber
from modules.bots.telegram import TelegramError

pytestmark = pytest.mark.anyio

TOKEN = "7000001:AAH" + "x" * 32


@pytest.fixture
def https_base(monkeypatch):
    monkeypatch.setattr(settings, "telegram_webhook_base_url", "https://bots.example.com")


async def _connect(client) -> dict:
    r = await client.post("/api/v1/bots", json={"token": TOKEN})
    assert r.status_code == 201, r.text
    return r.json()


async def _bot_row(bot_id: str) -> Bot:
    async with AsyncSessionLocal() as db:
        return await db.get(Bot, bot_id)


def _start_update(text: str, user_id: int = 42, first_name: str = "Ольга") -> dict:
    return {
        "update_id": 1,
        "message": {
            "message_id": 1,
            "chat": {"id": user_id, "type": "private"},
            "from": {"id": user_id, "is_bot": False, "first_name": first_name, "username": "olga"},
            "text": text,
        },
    }


# ---- чистые функции ------------------------------------------------------

def test_parse_start():
    assert parse_start("/start") == (True, None)
    assert parse_start("/start insta_reels") == (True, "insta_reels")
    assert parse_start("/start@visa_bot promo-1") == (True, "promo-1")
    assert parse_start("/start bad payload!") == (True, None)
    assert parse_start("привет") == (False, None)
    assert parse_start("/started") == (False, None)


def test_render_welcome_escapes_name():
    sub = Subscriber(first_name="<b>Hack</b>", username=None)
    assert render_welcome("Привет, {first_name}!{username}", sub) == "Привет, &lt;b&gt;Hack&lt;/b&gt;!"


# ---- подключение ---------------------------------------------------------

async def test_connect_bot_sets_webhook_and_encrypts_token(client, fake_tg, https_base):
    bot = await _connect(client)
    assert bot["username"] == "visa_test_bot"
    assert bot["webhook_status"] == "ok"
    assert TOKEN not in str(bot)

    _, method, params = fake_tg.calls[-1]
    assert method == "setWebhook"
    assert params["url"] == f"https://bots.example.com/api/v1/tg/{bot['id']}"

    row = await _bot_row(bot["id"])
    assert row.token_encrypted != TOKEN
    assert decrypt_token(row.token_encrypted) == TOKEN
    assert params["secret_token"] == row.webhook_secret


async def test_connect_without_https_marks_status(client, fake_tg):
    bot = await _connect(client)
    assert bot["webhook_status"] == "no_https"
    assert "setWebhook" not in fake_tg.methods()


async def test_connect_rejects_bad_format(client, fake_tg):
    r = await client.post("/api/v1/bots", json={"token": "not-a-token"})
    assert r.status_code == 422
    assert fake_tg.calls == []


async def test_connect_rejects_token_telegram_refuses(client, fake_tg):
    fake_tg.errors["getMe"] = TelegramError("Unauthorized", 401)
    r = await client.post("/api/v1/bots", json={"token": TOKEN})
    assert r.status_code == 400


async def test_connect_duplicate(client, fake_tg):
    await _connect(client)
    r = await client.post("/api/v1/bots", json={"token": TOKEN})
    assert r.status_code == 409


async def test_update_and_disable(client, fake_tg, https_base):
    bot = await _connect(client)
    r = await client.patch(
        f"/api/v1/bots/{bot['id']}",
        json={
            "welcome_text": "Привет, {first_name}!",
            "welcome_buttons": [{"text": "Канал", "url": "https://t.me/visanews2u"}],
        },
    )
    assert r.status_code == 200
    assert r.json()["welcome_buttons"][0]["text"] == "Канал"

    r = await client.patch(f"/api/v1/bots/{bot['id']}", json={"is_active": False})
    assert r.json()["webhook_status"] == "disabled"
    assert fake_tg.methods()[-1] == "deleteWebhook"


async def test_bad_button_url_rejected(client, fake_tg):
    bot = await _connect(client)
    r = await client.patch(
        f"/api/v1/bots/{bot['id']}",
        json={"welcome_buttons": [{"text": "x", "url": "javascript:alert(1)"}]},
    )
    assert r.status_code == 422


# ---- вебхук --------------------------------------------------------------

async def test_webhook_requires_secret(client, fake_tg):
    bot = await _connect(client)
    r = await client.post(f"/api/v1/tg/{bot['id']}", json=_start_update("/start"))
    assert r.status_code == 403
    r = await client.post(
        f"/api/v1/tg/{bot['id']}",
        json=_start_update("/start"),
        headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"},
    )
    assert r.status_code == 403


async def test_start_creates_subscriber_with_source_and_sends_welcome(client, fake_tg, https_base):
    bot = await _connect(client)
    await client.patch(
        f"/api/v1/bots/{bot['id']}",
        json={
            "welcome_text": "Привет, {first_name}!",
            "welcome_buttons": [{"text": "Канал", "url": "https://t.me/visanews2u"}],
        },
    )
    secret = (await _bot_row(bot["id"])).webhook_secret
    headers = {"X-Telegram-Bot-Api-Secret-Token": secret}

    r = await client.post(f"/api/v1/tg/{bot['id']}", json=_start_update("/start reels"), headers=headers)
    assert r.status_code == 200

    _, method, params = fake_tg.calls[-1]
    assert method == "sendMessage"
    assert params["chat_id"] == 42
    assert params["text"] == "Привет, Ольга!"
    assert params["reply_markup"] == {
        "inline_keyboard": [[{"text": "Канал", "url": "https://t.me/visanews2u"}]]
    }

    # повторный /start с другой меткой не перезаписывает первоисточник
    await client.post(f"/api/v1/tg/{bot['id']}", json=_start_update("/start other"), headers=headers)

    r = await client.get(f"/api/v1/bots/{bot['id']}/subscribers")
    page = r.json()
    assert page["total"] == 1
    assert page["items"][0]["source"] == "reels"
    assert page["items"][0]["username"] == "olga"

    r = await client.get(f"/api/v1/bots/{bot['id']}/sources")
    assert r.json() == [{"source": "reels", "count": 1}]

    r = await client.get(f"/api/v1/bots/{bot['id']}")
    assert r.json()["subscribers_count"] == 1


async def test_blocked_user_tracked(client, fake_tg):
    bot = await _connect(client)
    secret = (await _bot_row(bot["id"])).webhook_secret
    headers = {"X-Telegram-Bot-Api-Secret-Token": secret}
    await client.post(f"/api/v1/tg/{bot['id']}", json=_start_update("/start"), headers=headers)
    await client.post(
        f"/api/v1/tg/{bot['id']}",
        json={
            "update_id": 2,
            "my_chat_member": {
                "chat": {"id": 42, "type": "private"},
                "from": {"id": 42, "is_bot": False, "first_name": "Ольга"},
                "new_chat_member": {"status": "kicked"},
            },
        },
        headers=headers,
    )
    async with AsyncSessionLocal() as db:
        sub = await db.scalar(select(Subscriber).where(Subscriber.bot_id == bot["id"]))
        assert sub.is_blocked is True


async def test_handler_error_still_returns_200(client, fake_tg):
    bot = await _connect(client)
    secret = (await _bot_row(bot["id"])).webhook_secret
    fake_tg.errors["sendMessage"] = TelegramError("Internal", 500)
    r = await client.post(
        f"/api/v1/tg/{bot['id']}",
        json=_start_update("/start"),
        headers={"X-Telegram-Bot-Api-Secret-Token": secret},
    )
    assert r.status_code == 200


# ---- изоляция ------------------------------------------------------------

async def test_other_user_cannot_see_bot(client, fake_tg):
    from database import AsyncSessionLocal as S
    from modules.auth.models import User, UserRole
    from modules.auth.utils import create_access_token, hash_password
    import httpx
    from main import app

    bot = await _connect(client)
    async with S() as db:
        other = User(email="other-bots@example.com", hashed_password=hash_password("x" * 8),
                     role=UserRole.USER, is_active=True, is_email_verified=True)
        db.add(other)
        await db.commit()
        await db.refresh(other)
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test",
            headers={"Authorization": f"Bearer {create_access_token(other.id)}"},
        ) as c2:
            assert (await c2.get(f"/api/v1/bots/{bot['id']}")).status_code == 404
            assert (await c2.get("/api/v1/bots")).json() == []
    finally:
        async with S() as db:
            await db.delete(await db.get(User, other.id))
            await db.commit()
