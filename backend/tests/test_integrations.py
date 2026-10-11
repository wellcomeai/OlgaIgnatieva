from __future__ import annotations

import hashlib
from urllib.parse import parse_qs, urlparse

import pytest

from config import settings

from tests.helpers import connect_bot, message_update, send_update

pytestmark = pytest.mark.anyio


def field(state, key):
    return next(f for f in state["robokassa"] if f["key"] == key)


async def test_ui_settings_override_env_and_hide_secrets(client, fake_tg, monkeypatch):
    monkeypatch.setattr(settings, "robokassa_merchant_login", "env_shop")
    monkeypatch.setattr(settings, "robokassa_password1", "")
    monkeypatch.setattr(settings, "robokassa_password2", "")

    state = (await client.get("/api/v1/settings/integrations")).json()
    assert field(state, "robokassa_merchant_login") | {"value": "env_shop", "source": "env"} == field(state, "robokassa_merchant_login")
    assert state["urls"]["robokassa_configured"] is False

    r = await client.put("/api/v1/settings/integrations", json={"values": {
        "robokassa_merchant_login": "ui_shop", "robokassa_password1": "p1-secret",
        "robokassa_password2": "p2-secret", "robokassa_test_mode": False}})
    assert r.status_code == 200
    state = r.json()
    assert field(state, "robokassa_merchant_login")["value"] == "ui_shop"
    p1 = field(state, "robokassa_password1")
    assert p1["is_set"] is True and p1["value"] is None
    assert "p1-secret" not in r.text
    assert state["urls"]["robokassa_configured"] is True and state["urls"]["test_mode"] is False

    # пустой секрет при сохранении = «не менять»
    await client.put("/api/v1/settings/integrations", json={"values": {"robokassa_password1": ""}})
    assert field((await client.get("/api/v1/settings/integrations")).json(), "robokassa_password1")["is_set"]

    # ссылка на оплату подписана значениями из кабинета
    bot = await connect_bot(client)
    product = (await client.post("/api/v1/products", json={"title": "Гайд", "price": "500"})).json()
    await send_update(client, bot["id"], message_update("/start buy-" + product["id"].replace("-", "")))
    url = fake_tg.last("SendMessage").reply_markup.inline_keyboard[0][0].url
    q = {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}
    assert q["MerchantLogin"] == "ui_shop" and "IsTest" not in q
    expected = hashlib.md5(f"ui_shop:500.00:{q['InvId']}:p1-secret:Shp_bot=visa_test_bot:Shp_kind=order".encode()).hexdigest()
    assert q["SignatureValue"] == expected

    # сброс к .env
    state = (await client.put("/api/v1/settings/integrations", json={"reset": ["robokassa_merchant_login"]})).json()
    assert field(state, "robokassa_merchant_login")["value"] == "env_shop"


async def test_invalid_choice_rejected(client):
    r = await client.put("/api/v1/settings/integrations", json={"values": {"robokassa_tax": "vat99"}})
    assert r.status_code == 422


async def test_only_owner(client):
    import httpx

    from database import AsyncSessionLocal
    from main import app
    from modules.auth.models import User, UserRole
    from modules.auth.utils import create_access_token, hash_password

    async with AsyncSessionLocal() as db:
        u = User(email="helper@example.com", hashed_password=hash_password("x" * 8),
                 role=UserRole.USER, is_active=True, is_email_verified=True)
        db.add(u)
        await db.commit()
        await db.refresh(u)
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test",
                                     headers={"Authorization": f"Bearer {create_access_token(u.id)}"}) as c:
            assert (await c.get("/api/v1/settings/integrations")).status_code == 403
    finally:
        async with AsyncSessionLocal() as db:
            await db.delete(await db.get(User, u.id))
            await db.commit()


# ---- лендинг и реквизиты -------------------------------------------------

async def test_public_site_info(client, fake_tg):
    import httpx

    from main import app

    bot = await connect_bot(client)
    product = (await client.post("/api/v1/products", json={"title": "Виза США B1/B2", "price": "990"})).json()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as anon:
        info = (await anon.get("/api/v1/public/site")).json()
        assert info["offer"] is None and info["seller"]["name"] == ""

        await client.put("/api/v1/settings/integrations", json={"values": {
            "seller_name": "Игнатьева Ольга", "seller_inn": "770000000000", "seller_email": "hello@example.com",
            "landing_product_id": product["id"], "landing_bot_id": bot["id"]}})
        info = (await anon.get("/api/v1/public/site")).json()
        assert info["seller"]["name"] == "Игнатьева Ольга" and info["seller"]["inn"] == "770000000000"
        assert info["offer"]["price"] == "990.00"
        assert info["offer"]["buy_url"] == f"https://t.me/visa_test_bot?start=buy-{product['id'].replace('-', '')}"

        # снятый с продажи продукт с лендинга пропадает
        await client.patch(f"/api/v1/products/{product['id']}", json={"is_active": False})
        assert (await anon.get("/api/v1/public/site")).json()["offer"] is None


async def test_offer_card_links_to_offer(client, fake_tg, monkeypatch):
    monkeypatch.setattr(settings, "robokassa_merchant_login", "shop")
    monkeypatch.setattr(settings, "robokassa_password1", "p1")
    monkeypatch.setattr(settings, "robokassa_password2", "p2")
    bot = await connect_bot(client)
    product = (await client.post("/api/v1/products", json={"title": "Гайд", "price": "990"})).json()
    await send_update(client, bot["id"], message_update("/start buy-" + product["id"].replace("-", "")))
    assert "/offer" in fake_tg.last("SendMessage").text
