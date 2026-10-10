from __future__ import annotations

import hashlib
from decimal import Decimal
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from modules.shop.models import Order, ProductFile

from tests.helpers import callback_update, connect_bot, message_update, send_update

pytestmark = pytest.mark.anyio


@pytest.fixture
def robokassa(monkeypatch):
    monkeypatch.setattr(settings, "robokassa_merchant_login", "visashop")
    monkeypatch.setattr(settings, "robokassa_password1", "pass1")
    monkeypatch.setattr(settings, "robokassa_password2", "pass2")
    monkeypatch.setattr(settings, "robokassa_test_mode", True)


def md5(s: str) -> str:
    return hashlib.md5(s.encode()).hexdigest()


async def create_product(client, title="Гайд «Шенген 2026»", price="990") -> dict:
    r = await client.post(
        "/api/v1/products",
        json={"title": title, "price": price, "description": "PDF на 40 страниц"},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def upload(client, product_id: str, name="guide.pdf", data=b"%PDF-1.4 test") -> dict:
    r = await client.post(
        f"/api/v1/products/{product_id}/files",
        files={"file": (name, data, "application/pdf")},
    )
    assert r.status_code == 201, r.text
    return r.json()


def pay_params(fake_tg) -> dict[str, str]:
    """Параметры ссылки на оплату из последней карточки товара."""
    msg = fake_tg.last("SendMessage")
    url = msg.reply_markup.inline_keyboard[0][0].url
    assert url.startswith("https://auth.robokassa.ru/Merchant/Index.aspx?")
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


async def robokassa_result(client, inv_id: str, out_sum: str, *, password="pass2", bot="visa_test_bot"):
    sig = md5(f"{out_sum}:{inv_id}:{password}:Shp_bot={bot}:Shp_kind=order")
    return await client.post(
        "/api/v1/webhooks/robokassa",
        data={"OutSum": out_sum, "InvId": inv_id, "SignatureValue": sig.upper(),
              "Shp_bot": bot, "Shp_kind": "order"},
    )


# ---- продукты в кабинете -------------------------------------------------

async def test_product_crud_and_files(client, fake_tg, media_root):
    bot = await connect_bot(client)
    product = await create_product(client)
    assert product["price"] == "990.00"
    assert product["buy_links"] == [f"https://t.me/visa_test_bot?start=buy-{product['id'].replace('-', '')}"]

    f = await upload(client, product["id"], name="../../etc/passwd.pdf")
    assert f["filename"] == "passwd.pdf"
    async with AsyncSessionLocal() as db:
        row = await db.get(ProductFile, f["id"])
        stored = media_root / row.storage_name
        assert stored.read_bytes() == b"%PDF-1.4 test"
        assert media_root in stored.resolve().parents

    r = await client.patch(f"/api/v1/products/{product['id']}", json={"price": "1490.50", "protect_content": True})
    assert r.json()["price"] == "1490.50"
    assert r.json()["files_count"] == 1

    await client.patch(f"/api/v1/bots/{bot['id']}", json={"welcome_product_ids": [product["id"]]})
    assert (await client.delete(f"/api/v1/products/{product['id']}")).status_code == 204
    assert not stored.exists()
    assert (await client.get(f"/api/v1/bots/{bot['id']}")).json()["welcome_product_ids"] == []


async def test_empty_file_rejected(client, fake_tg):
    product = await create_product(client)
    r = await client.post(
        f"/api/v1/products/{product['id']}/files", files={"file": ("a.pdf", b"", "application/pdf")}
    )
    assert r.status_code == 422


async def test_price_validation(client, fake_tg):
    r = await client.post("/api/v1/products", json={"title": "x", "price": "0"})
    assert r.status_code == 422
    r = await client.post("/api/v1/products", json={"title": "x", "price": "10.555"})
    assert r.status_code == 422


async def test_foreign_product_in_welcome_rejected(client, fake_tg):
    bot = await connect_bot(client)
    r = await client.patch(
        f"/api/v1/bots/{bot['id']}",
        json={"welcome_product_ids": ["00000000-0000-0000-0000-000000000001"]},
    )
    assert r.status_code == 422


# ---- покупка в боте ------------------------------------------------------

async def test_full_purchase_flow(client, fake_tg, robokassa):
    bot = await connect_bot(client)
    product = await create_product(client)
    await upload(client, product["id"])
    payload = "buy-" + product["id"].replace("-", "")

    # 1. Подписчик открывает ссылку на покупку → карточка с кнопкой оплаты
    await send_update(client, bot["id"], message_update(f"/start {payload}"))
    card = fake_tg.last("SendMessage")
    assert "Гайд «Шенген 2026»" in card.text and "990" in card.text
    params = pay_params(fake_tg)
    assert params["OutSum"] == "990.00"
    assert params["IsTest"] == "1"
    assert params["Shp_kind"] == "order" and params["Shp_bot"] == "visa_test_bot"
    expected_sig = md5(f"visashop:990.00:{params['InvId']}:pass1:Shp_bot=visa_test_bot:Shp_kind=order")
    assert params["SignatureValue"] == expected_sig

    # повторное нажатие не создаёт новый счёт
    await send_update(client, bot["id"], message_update(f"/start {payload}"))
    assert pay_params(fake_tg)["InvId"] == params["InvId"]

    orders = (await client.get("/api/v1/orders")).json()
    assert orders["total"] == 1 and orders["items"][0]["status"] == "pending"
    assert orders["items"][0]["subscriber_username"] == "olga"

    # 2. Робокасса подтверждает оплату → заказ оплачен, файлы выданы
    sent_before = len(fake_tg.calls)
    r = await robokassa_result(client, params["InvId"], "990.000000")
    assert r.status_code == 200
    assert r.text == f"OK{params['InvId']}"

    new_calls = fake_tg.calls[sent_before:]
    assert [name for name, _ in new_calls] == ["SendMessage", "SendDocument"]
    assert "Спасибо за покупку, Ольга" in new_calls[0][1].text
    assert new_calls[1][1].chat_id == 42

    async with AsyncSessionLocal() as db:
        order = await db.scalar(select(Order).where(Order.inv_id == int(params["InvId"])))
        assert order.status == "paid" and order.delivered_at is not None
        f = await db.scalar(select(ProductFile).where(ProductFile.product_id == order.product_id))
        assert f.tg_file_ids[bot["id"]].startswith("file-")

    # 3. Повторное уведомление Робокассы — без повторной выдачи
    calls = len(fake_tg.calls)
    r = await robokassa_result(client, params["InvId"], "990.00")
    assert r.text == f"OK{params['InvId']}"
    assert len(fake_tg.calls) == calls

    # 4. Повторная «покупка» — материалы ещё раз, из кеша file_id, без нового счёта
    await send_update(client, bot["id"], message_update(f"/start {payload}"))
    doc = fake_tg.last("SendDocument")
    assert isinstance(doc.document, str) and doc.document.startswith("file-")
    assert (await client.get("/api/v1/orders")).json()["total"] == 1

    stats = (await client.get("/api/v1/orders/stats")).json()
    assert Decimal(stats["revenue"]) == Decimal("990") and stats["paid_count"] == 1
    listed = (await client.get("/api/v1/products")).json()[0]
    assert listed["sales_count"] == 1 and Decimal(listed["revenue"]) == Decimal("990")


async def test_result_rejects_bad_signature_and_amount(client, fake_tg, robokassa):
    bot = await connect_bot(client)
    product = await create_product(client)
    await send_update(client, bot["id"], message_update("/start buy-" + product["id"].replace("-", "")))
    inv = pay_params(fake_tg)["InvId"]

    assert (await robokassa_result(client, inv, "990.00", password="wrong")).status_code == 400
    # подпись верная, но сумма не совпадает с заказом
    assert (await robokassa_result(client, inv, "1.00")).status_code == 400
    # подмена Shp-параметра ломает подпись
    sig = md5(f"990.00:{inv}:pass2:Shp_bot=visa_test_bot:Shp_kind=order")
    r = await client.post(
        "/api/v1/webhooks/robokassa",
        data={"OutSum": "990.00", "InvId": inv, "SignatureValue": sig,
              "Shp_bot": "other_bot", "Shp_kind": "order"},
    )
    assert r.status_code == 400
    assert (await client.get("/api/v1/orders")).json()["items"][0]["status"] == "pending"


async def test_welcome_product_button_and_callback(client, fake_tg, robokassa):
    bot = await connect_bot(client)
    product = await create_product(client, price="1500")
    await client.patch(f"/api/v1/bots/{bot['id']}", json={"welcome_product_ids": [product["id"]]})

    await send_update(client, bot["id"], message_update("/start"))
    button = fake_tg.last("SendMessage").reply_markup.inline_keyboard[0][0]
    assert button.callback_data == f"buy:{product['id']}"
    assert "1 500" in button.text

    await send_update(client, bot["id"], callback_update(button.callback_data))
    assert "AnswerCallbackQuery" in fake_tg.methods()
    assert pay_params(fake_tg)["OutSum"] == "1500.00"


async def test_inactive_product_not_sold(client, fake_tg, robokassa):
    bot = await connect_bot(client)
    product = await create_product(client)
    await client.patch(f"/api/v1/products/{product['id']}", json={"is_active": False})
    await send_update(client, bot["id"], callback_update(f"buy:{product['id']}"))
    assert "недоступен" in fake_tg.last("SendMessage").text
    assert (await client.get("/api/v1/orders")).json()["total"] == 0


async def test_offer_without_robokassa(client, fake_tg):
    bot = await connect_bot(client)
    product = await create_product(client)
    await send_update(client, bot["id"], message_update("/start buy-" + product["id"].replace("-", "")))
    assert "Оплата временно недоступна" in fake_tg.last("SendMessage").text
    assert (await client.get("/api/v1/orders")).json()["total"] == 0


async def test_payments_config(client, fake_tg, robokassa):
    cfg = (await client.get("/api/v1/payments/config")).json()
    assert cfg["robokassa_configured"] is True
    assert cfg["result_url"].endswith("/api/v1/webhooks/robokassa")
    assert cfg["success_url"].endswith("/pay/success")


# ---- регистрация ---------------------------------------------------------

async def test_registration_closed(client):
    assert (await client.get("/api/v1/auth/registration")).json() == {"enabled": False}
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": "stranger@example.com", "password": "secret12345", "first_name": "A", "last_name": "B"},
    )
    assert r.status_code == 403
