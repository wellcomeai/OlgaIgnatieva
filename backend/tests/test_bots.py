from __future__ import annotations

import pytest
from aiogram.exceptions import TelegramBadRequest, TelegramServerError, TelegramUnauthorizedError
from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from modules.bots.crypto import decrypt_token
from modules.bots.handlers import START_PARAM_RE
from modules.bots.messaging import render_template
from modules.bots.models import Subscriber

from tests.helpers import TOKEN, bot_row, connect_bot, message_update, send_update

pytestmark = pytest.mark.anyio


@pytest.fixture
def https_base(monkeypatch):
    monkeypatch.setattr(settings, "telegram_webhook_base_url", "https://bots.example.com")


# ---- чистые функции ------------------------------------------------------

def test_start_param_pattern():
    assert START_PARAM_RE.match("insta_reels")
    assert START_PARAM_RE.match("buy-" + "a" * 32)
    assert not START_PARAM_RE.match("bad payload!")
    assert not START_PARAM_RE.match("x" * 65)


def test_render_template_escapes_name():
    sub = Subscriber(first_name="<b>Hack</b>", username=None)
    assert render_template("Привет, {first_name}!{username}", sub) == "Привет, &lt;b&gt;Hack&lt;/b&gt;!"


# ---- подключение ---------------------------------------------------------

async def test_connect_bot_sets_webhook_and_encrypts_token(client, fake_tg, https_base):
    bot = await connect_bot(client)
    assert bot["username"] == "visa_test_bot"
    assert bot["webhook_status"] == "ok"
    assert TOKEN not in str(bot)

    hook = fake_tg.last("SetWebhook")
    assert hook.url == f"https://bots.example.com/api/v1/tg/{bot['id']}"
    assert "callback_query" in hook.allowed_updates

    row = await bot_row(bot["id"])
    assert row.token_encrypted != TOKEN
    assert decrypt_token(row.token_encrypted) == TOKEN
    assert hook.secret_token == row.webhook_secret


async def test_connect_without_https_marks_status(client, fake_tg):
    bot = await connect_bot(client)
    assert bot["webhook_status"] == "no_https"
    assert "SetWebhook" not in fake_tg.methods()


async def test_webhook_error_saved(client, fake_tg, https_base):
    fake_tg.errors["SetWebhook"] = (TelegramBadRequest, "Bad Request: bad webhook: HTTPS url must be provided")
    bot = await connect_bot(client)
    assert bot["webhook_status"] == "error"
    assert "bad webhook" in bot["webhook_error"]


async def test_connect_rejects_bad_format(client, fake_tg):
    r = await client.post("/api/v1/bots", json={"token": "not-a-token"})
    assert r.status_code == 422
    assert fake_tg.calls == []


async def test_connect_rejects_token_telegram_refuses(client, fake_tg):
    fake_tg.errors["GetMe"] = (TelegramUnauthorizedError, "Unauthorized")
    r = await client.post("/api/v1/bots", json={"token": TOKEN})
    assert r.status_code == 400


async def test_connect_duplicate(client, fake_tg):
    await connect_bot(client)
    r = await client.post("/api/v1/bots", json={"token": TOKEN})
    assert r.status_code == 409


async def test_update_and_disable(client, fake_tg, https_base):
    bot = await connect_bot(client)
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
    assert fake_tg.methods()[-1] == "DeleteWebhook"


async def test_bad_button_url_rejected(client, fake_tg):
    bot = await connect_bot(client)
    r = await client.patch(
        f"/api/v1/bots/{bot['id']}",
        json={"welcome_buttons": [{"text": "x", "url": "javascript:alert(1)"}]},
    )
    assert r.status_code == 422


async def test_webhook_info(client, fake_tg):
    bot = await connect_bot(client)
    r = await client.get(f"/api/v1/bots/{bot['id']}/webhook")
    assert r.status_code == 200
    assert r.json()["url_set"] is False


# ---- вебхук --------------------------------------------------------------

async def test_webhook_requires_secret(client, fake_tg):
    bot = await connect_bot(client)
    r = await client.post(f"/api/v1/tg/{bot['id']}", json=message_update("/start"))
    assert r.status_code == 403
    r = await client.post(
        f"/api/v1/tg/{bot['id']}",
        json=message_update("/start"),
        headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"},
    )
    assert r.status_code == 403


async def test_start_creates_subscriber_with_source_and_sends_welcome(client, fake_tg, https_base):
    bot = await connect_bot(client)
    await client.patch(
        f"/api/v1/bots/{bot['id']}",
        json={
            "welcome_text": "Привет, {first_name}!",
            "welcome_buttons": [{"text": "Канал", "url": "https://t.me/visanews2u"}],
        },
    )
    await send_update(client, bot["id"], message_update("/start reels"))

    msg = fake_tg.last("SendMessage")
    assert msg.chat_id == 42
    assert msg.text == "Привет, Ольга!"
    button = msg.reply_markup.inline_keyboard[0][0]
    assert (button.text, button.url) == ("Канал", "https://t.me/visanews2u")

    # повторный /start с другой меткой не перезаписывает первоисточник
    await send_update(client, bot["id"], message_update("/start other"))

    page = (await client.get(f"/api/v1/bots/{bot['id']}/subscribers")).json()
    assert page["total"] == 1
    assert page["items"][0]["source"] == "reels"
    assert page["items"][0]["username"] == "olga"

    r = await client.get(f"/api/v1/bots/{bot['id']}/sources")
    assert r.json() == [{"source": "reels", "count": 1}]
    assert (await client.get(f"/api/v1/bots/{bot['id']}")).json()["subscribers_count"] == 1


async def test_broken_html_falls_back_to_plain_text(client, fake_tg):
    bot = await connect_bot(client)
    await client.patch(f"/api/v1/bots/{bot['id']}", json={"welcome_text": "Привет <b>без закрытия"})
    fake_tg.errors["SendMessage"] = (TelegramBadRequest, "Bad Request: can't parse entities")
    await send_update(client, bot["id"], message_update("/start"))
    first, second = fake_tg.sent("SendMessage")[-2:]
    assert second.text == first.text
    assert second.parse_mode is None


async def test_plain_message_registers_subscriber(client, fake_tg):
    bot = await connect_bot(client)
    await send_update(client, bot["id"], message_update("привет", user_id=77))
    assert "SendMessage" not in fake_tg.methods()
    page = (await client.get(f"/api/v1/bots/{bot['id']}/subscribers")).json()
    assert page["items"][0]["tg_user_id"] == 77


async def test_blocked_user_tracked(client, fake_tg):
    bot = await connect_bot(client)
    await send_update(client, bot["id"], message_update("/start"))
    await send_update(
        client,
        bot["id"],
        {
            "update_id": 2,
            "my_chat_member": {
                "chat": {"id": 42, "type": "private"},
                "from": {"id": 42, "is_bot": False, "first_name": "Ольга"},
                "date": 1_700_000_000,
                "old_chat_member": {"status": "member", "user": {"id": 7000001, "is_bot": True, "first_name": "Visa Bot"}},
                "new_chat_member": {"status": "kicked", "user": {"id": 7000001, "is_bot": True, "first_name": "Visa Bot"}, "until_date": 0},
            },
        },
    )
    async with AsyncSessionLocal() as db:
        sub = await db.scalar(select(Subscriber).where(Subscriber.bot_id == bot["id"]))
        assert sub.is_blocked is True


async def test_handler_error_still_returns_200(client, fake_tg):
    bot = await connect_bot(client)
    fake_tg.errors["SendMessage"] = (TelegramServerError, "Internal Server Error")
    await send_update(client, bot["id"], message_update("/start"))


# ---- изоляция ------------------------------------------------------------

async def test_other_user_cannot_see_bot(client, fake_tg):
    import httpx

    from main import app
    from modules.auth.models import User, UserRole
    from modules.auth.utils import create_access_token, hash_password

    bot = await connect_bot(client)
    async with AsyncSessionLocal() as db:
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
        async with AsyncSessionLocal() as db:
            await db.delete(await db.get(User, other.id))
            await db.commit()
