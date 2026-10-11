from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update

from config import settings
from database import AsyncSessionLocal
from modules.bots.models import Subscriber
from modules.flows.models import FlowRun, RunStatus
from modules.flows.scheduler import process_due_runs

from tests.helpers import callback_update, connect_bot, message_update, send_update

pytestmark = pytest.mark.anyio


def n(id, type, **data):
    return {"id": id, "type": type, "position": {"x": 0, "y": 0}, "data": data}


def e(source, target, handle="next"):
    return {"id": f"{source}-{handle}-{target}", "source": source, "sourceHandle": handle, "target": target}


def graph(nodes, edges):
    return {"nodes": nodes, "edges": edges}


async def make_flow(client, bot_id, g, name="Воронка", active=True):
    r = await client.post(f"/api/v1/bots/{bot_id}/flows", json={"name": name})
    assert r.status_code == 201, r.text
    flow = r.json()
    r = await client.put(f"/api/v1/flows/{flow['id']}", json={"graph": g, "is_active": active})
    assert r.status_code == 200, r.text
    return r.json()


def texts(fake_tg):
    return [m.text for m in fake_tg.sent("SendMessage")]


async def sub_row(bot_id, tg_user_id=42) -> Subscriber:
    async with AsyncSessionLocal() as db:
        return await db.scalar(
            select(Subscriber).where(Subscriber.bot_id == bot_id, Subscriber.tg_user_id == tg_user_id)
        )


async def runs(flow_id):
    async with AsyncSessionLocal() as db:
        return (await db.scalars(select(FlowRun).where(FlowRun.flow_id == flow_id).order_by(FlowRun.created_at))).all()


# ---- шаблоны и проверка --------------------------------------------------

async def test_templates_create_drafts_with_problems(client, fake_tg):
    bot = await connect_bot(client)
    r = await client.post(f"/api/v1/bots/{bot['id']}/flows", json={"name": "Продажа", "template": "welcome_sale"})
    flow = r.json()
    assert flow["is_active"] is False
    assert any("выберите продукт" in p for p in flow["problems"])
    # черновик с проблемами нельзя включить
    r = await client.put(f"/api/v1/flows/{flow['id']}", json={"is_active": True})
    assert r.status_code == 422 and "выберите продукт" in r.json()["detail"]
    # но можно пересохранить
    r = await client.put(f"/api/v1/flows/{flow['id']}", json={"graph": flow["graph"], "name": "Продажа 2"})
    assert r.status_code == 200
    listed = (await client.get(f"/api/v1/bots/{bot['id']}/flows")).json()
    assert [f["name"] for f in listed] == ["Продажа 2"]


async def test_structural_errors_rejected(client, fake_tg):
    bot = await connect_bot(client)
    flow = (await client.post(f"/api/v1/bots/{bot['id']}/flows", json={"name": "x"})).json()
    bad = [
        graph([n("a", "message", text="hi")], []),                                   # нет триггера
        graph([n("s", "trigger", kind="start"), n("s", "message", text="x")], []),    # дубль id
        graph([n("s", "trigger", kind="start")], [e("s", "ghost")]),                 # битая связь
        graph([n("s", "trigger", kind="start"), n("m", "message", text="x", buttons=[{"id": "b", "type": "next", "text": "go"}])],
              [e("s", "m"), e("m", "s", "btn:b")]),                                   # стрелка в старт
        graph([n("s", "trigger", kind="start"), n("x", "evil")], []),                 # неизвестный блок
    ]
    for g in bad:
        r = await client.put(f"/api/v1/flows/{flow['id']}", json={"graph": g})
        assert r.status_code == 422, g


# ---- исполнение ----------------------------------------------------------

async def test_message_branch_buttons(client, fake_tg):
    bot = await connect_bot(client)
    flow = await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="start"),
         n("q", "message", text="Привет, {first_name}! Вам виза куда?",
           buttons=[{"id": "eu", "type": "next", "text": "Европа"},
                    {"id": "us", "type": "next", "text": "США"},
                    {"id": "site", "type": "url", "text": "Сайт", "url": "https://example.com"}]),
         n("eu_msg", "message", text="Шенген — отличный выбор"),
         n("us_msg", "message", text="США — сложнее, но реально")],
        [e("s", "q"), e("q", "eu_msg", "btn:eu"), e("q", "us_msg", "btn:us")]))

    await send_update(client, bot["id"], message_update("/start"))
    msg = fake_tg.last("SendMessage")
    assert msg.text == "Привет, Ольга! Вам виза куда?"
    kb = msg.reply_markup.inline_keyboard
    assert kb[2][0].url == "https://example.com"
    us_cb = kb[1][0].callback_data
    assert us_cb.startswith("fl:") and len(us_cb.encode()) <= 64

    await send_update(client, bot["id"], callback_update(us_cb))
    assert texts(fake_tg)[-1] == "США — сложнее, но реально"
    assert (await runs(flow["id"]))[-1].status == RunStatus.FINISHED

    # повторное нажатие старой кнопки — «неактивна», без новых сообщений
    before = len(texts(fake_tg))
    await send_update(client, bot["id"], callback_update(us_cb))
    assert len(texts(fake_tg)) == before
    assert fake_tg.last("AnswerCallbackQuery").text == "Эта кнопка уже неактивна"

    stats = (await client.get(f"/api/v1/flows/{flow['id']}")).json()
    assert stats["node_stats"] == {"s": 1, "q": 1, "us_msg": 1}
    assert stats["entered"] == 1 and stats["in_progress"] == 0


async def test_delay_resumed_by_scheduler(client, fake_tg):
    bot = await connect_bot(client)
    flow = await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="start"), n("m1", "message", text="Сейчас"),
         n("d", "delay", amount=2, unit="hours"), n("m2", "message", text="Через 2 часа")],
        [e("s", "m1"), e("m1", "d"), e("d", "m2")]))
    await send_update(client, bot["id"], message_update("/start"))
    assert texts(fake_tg)[-1] == "Сейчас"
    run = (await runs(flow["id"]))[-1]
    assert run.status == RunStatus.WAITING_DELAY
    assert timedelta(hours=1, minutes=59) < run.wake_at - datetime.now(timezone.utc) <= timedelta(hours=2)

    assert await process_due_runs() == 0  # ещё рано
    async with AsyncSessionLocal() as db:
        await db.execute(update(FlowRun).where(FlowRun.id == run.id).values(wake_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
        await db.commit()
    assert await process_due_runs() == 1
    assert texts(fake_tg)[-1] == "Через 2 часа"
    assert (await runs(flow["id"]))[-1].status == RunStatus.FINISHED


async def test_question_validation_and_condition_and_tags(client, fake_tg):
    bot = await connect_bot(client)
    await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="start"),
         n("ask", "question", text="Ваш email?", var="email", validate="email"),
         n("t", "tag", action="add", tag="лид"),
         n("c", "condition", kind="has_tag", tag="ЛИД"),
         n("yes", "message", text="Спасибо, {first_name}!"),
         n("no", "message", text="Что-то пошло не так")],
        [e("s", "ask"), e("ask", "t"), e("t", "c"), e("c", "yes", "yes"), e("c", "no", "no")]))
    await send_update(client, bot["id"], message_update("/start"))
    assert texts(fake_tg)[-1] == "Ваш email?"

    await send_update(client, bot["id"], message_update("не скажу"))
    assert "не email" in texts(fake_tg)[-1]
    await send_update(client, bot["id"], message_update("olga@example.com"))
    assert texts(fake_tg)[-1] == "Спасибо, Ольга!"

    sub = await sub_row(bot["id"])
    assert sub.vars == {"email": "olga@example.com"}
    assert sub.tags == ["лид"]


async def test_trigger_priority_label_then_generic(client, fake_tg):
    bot = await connect_bot(client)
    await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="start"), n("m", "message", text="Общая воронка")], [e("s", "m")]), name="общая")
    await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="start_label", value="reels"), n("m", "message", text="Из Reels")], [e("s", "m")]), name="reels")

    await send_update(client, bot["id"], message_update("/start reels", user_id=1))
    assert texts(fake_tg)[-1] == "Из Reels"
    await send_update(client, bot["id"], message_update("/start stories", user_id=2))
    assert texts(fake_tg)[-1] == "Общая воронка"
    await send_update(client, bot["id"], message_update("/start", user_id=3))
    assert texts(fake_tg)[-1] == "Общая воронка"


async def test_keyword_trigger(client, fake_tg):
    bot = await connect_bot(client)
    await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="keyword", value="Гайд"), n("m", "message", text="Держите гайд")], [e("s", "m")]))
    await send_update(client, bot["id"], message_update("а где мой гайд?"))
    assert texts(fake_tg)[-1] == "Держите гайд"


async def test_start_conflict_rejected(client, fake_tg):
    bot = await connect_bot(client)
    g = graph([n("s", "trigger", kind="start"), n("m", "message", text="x")], [e("s", "m")])
    await make_flow(client, bot["id"], g, name="Первая")
    second = (await client.post(f"/api/v1/bots/{bot['id']}/flows", json={"name": "Вторая"})).json()
    r = await client.put(f"/api/v1/flows/{second['id']}", json={"graph": g, "is_active": True})
    assert r.status_code == 409 and "Первая" in r.json()["detail"]


async def test_inactive_flow_falls_back_to_welcome(client, fake_tg):
    bot = await connect_bot(client)
    await client.patch(f"/api/v1/bots/{bot['id']}", json={"welcome_text": "Обычное приветствие"})
    await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="start"), n("m", "message", text="Воронка")], [e("s", "m")]), active=False)
    await send_update(client, bot["id"], message_update("/start"))
    assert texts(fake_tg)[-1] == "Обычное приветствие"


async def test_restart_cancels_previous_run(client, fake_tg):
    bot = await connect_bot(client)
    flow = await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="start"), n("d", "delay", amount=1, unit="days")], [e("s", "d")]))
    await send_update(client, bot["id"], message_update("/start"))
    await send_update(client, bot["id"], message_update("/start"))
    statuses = [r.status for r in await runs(flow["id"])]
    assert statuses == [RunStatus.CANCELLED, RunStatus.WAITING_DELAY]


async def test_loop_protection(client, fake_tg):
    bot = await connect_bot(client)
    flow = await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="start"), n("a", "tag", action="add", tag="x"), n("b", "tag", action="remove", tag="x")],
        [e("s", "a"), e("a", "b"), e("b", "a")]))
    await send_update(client, bot["id"], message_update("/start"))
    run = (await runs(flow["id"]))[-1]
    assert run.status == RunStatus.FAILED and "зацикливание" in run.error


# ---- воронки и продажи ---------------------------------------------------

@pytest.fixture
def robokassa(monkeypatch):
    monkeypatch.setattr(settings, "robokassa_merchant_login", "visashop")
    monkeypatch.setattr(settings, "robokassa_password1", "pass1")
    monkeypatch.setattr(settings, "robokassa_password2", "pass2")


async def test_offer_condition_and_purchase_trigger(client, fake_tg, robokassa):
    bot = await connect_bot(client)
    product = (await client.post("/api/v1/products", json={"title": "Гайд", "price": "990"})).json()
    await client.post(f"/api/v1/products/{product['id']}/files", files={"file": ("g.pdf", b"%PDF", "application/pdf")})

    sale = await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="start"), n("o", "offer", product_id=product["id"]),
         n("d", "delay", amount=1, unit="days"), n("c", "condition", kind="purchased", product_id=product["id"]),
         n("push", "message", text="Последний шанс!")],
        [e("s", "o"), e("o", "d"), e("d", "c"), e("c", "push", "no")]), name="Продажа")
    await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="purchase", value=product["id"]), n("thx", "message", text="Добро пожаловать в клуб!")],
        [e("s", "thx")]), name="После оплаты")

    await send_update(client, bot["id"], message_update("/start"))
    offer = fake_tg.last("SendMessage")
    url = offer.reply_markup.inline_keyboard[0][0].url
    assert "robokassa" in url
    inv = url.split("InvId=")[1].split("&")[0]

    # оплата → файлы + воронка «после оплаты»
    sig = hashlib.md5(f"990.00:{inv}:pass2:Shp_bot=visa_test_bot:Shp_kind=order".encode()).hexdigest()
    r = await client.post("/api/v1/webhooks/robokassa", data={
        "OutSum": "990.00", "InvId": inv, "SignatureValue": sig, "Shp_bot": "visa_test_bot", "Shp_kind": "order"})
    assert r.text == f"OK{inv}"
    assert texts(fake_tg)[-1] == "Добро пожаловать в клуб!"
    assert "SendDocument" in fake_tg.methods()

    # через сутки условие «купил» → ветка «нет» не срабатывает
    async with AsyncSessionLocal() as db:
        await db.execute(update(FlowRun).where(FlowRun.status == RunStatus.WAITING_DELAY)
                         .values(wake_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
        await db.commit()
    await process_due_runs()
    assert "Последний шанс!" not in texts(fake_tg)
    assert (await runs(sale["id"]))[-1].status == RunStatus.FINISHED


async def test_free_files_block(client, fake_tg):
    bot = await connect_bot(client)
    product = (await client.post("/api/v1/products", json={"title": "Чек-лист", "price": "1"})).json()
    await client.post(f"/api/v1/products/{product['id']}/files", files={"file": ("c.pdf", b"%PDF", "application/pdf")})
    await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="keyword", value="чеклист"), n("f", "files", product_id=product["id"]),
         n("m", "message", text="Готово")],
        [e("s", "f"), e("f", "m")]))
    await send_update(client, bot["id"], message_update("хочу чеклист"))
    assert fake_tg.methods()[-2:] == ["SendDocument", "SendMessage"]


# ---- подписка на канал ---------------------------------------------------

def test_parse_channel():
    from modules.bots.channels import parse_channel

    assert parse_channel("https://t.me/visanewstoyou") == "@visanewstoyou"
    assert parse_channel("t.me/visanewstoyou/") == "@visanewstoyou"
    assert parse_channel("@visanewstoyou") == "@visanewstoyou"
    assert parse_channel("visanewstoyou") == "@visanewstoyou"
    assert parse_channel("-1001234567890") == -1001234567890
    assert parse_channel("https://t.me/+AbCdEf") is None  # инвайт-ссылку не определить
    assert parse_channel("") is None


async def test_subscription_condition_branches(client, fake_tg):
    bot = await connect_bot(client)
    await make_flow(client, bot["id"], graph(
        [n("s", "trigger", kind="start"),
         n("ask", "message", text="Подпишитесь", buttons=[
             {"id": "chan", "type": "url", "text": "Канал", "url": "https://t.me/visanewstoyou"},
             {"id": "done", "type": "next", "text": "Я подписался"}]),
         n("c", "condition", kind="subscribed", channel="https://t.me/visanewstoyou"),
         n("yes", "message", text="Спасибо за подписку!"),
         n("no", "message", text="Пока не вижу подписки", buttons=[{"id": "again", "type": "next", "text": "Ещё раз"}])],
        [e("s", "ask"), e("ask", "c", "btn:done"), e("c", "yes", "yes"), e("c", "no", "no"), e("no", "c", "btn:again")]))

    await send_update(client, bot["id"], message_update("/start"))
    done_cb = fake_tg.last("SendMessage").reply_markup.inline_keyboard[1][0].callback_data

    # не подписан → ветка «нет»
    await send_update(client, bot["id"], callback_update(done_cb))
    assert texts(fake_tg)[-1] == "Пока не вижу подписки"
    check = fake_tg.last("GetChatMember")
    assert check.chat_id == "@visanewstoyou" and check.user_id == 42

    # подписался → «Ещё раз» → ветка «да»
    fake_tg.chat_members[42] = "member"
    again_cb = fake_tg.last("SendMessage").reply_markup.inline_keyboard[0][0].callback_data
    await send_update(client, bot["id"], callback_update(again_cb))
    assert texts(fake_tg)[-1] == "Спасибо за подписку!"


async def test_subscription_condition_requires_channel(client, fake_tg):
    bot = await connect_bot(client)
    flow = (await client.post(f"/api/v1/bots/{bot['id']}/flows", json={"name": "x", "template": "subscribe_gift"})).json()
    assert any("укажите канал" in p for p in flow["problems"])


async def test_channel_check_endpoint(client, fake_tg):
    bot = await connect_bot(client)
    url = f"/api/v1/bots/{bot['id']}/channel-check"
    r = (await client.get(url, params={"channel": "https://t.me/+invite"})).json()
    assert r["ok"] is False and "t.me/имя_канала" in r["error"]

    r = (await client.get(url, params={"channel": "@visanewstoyou"})).json()
    assert r == {"ok": False, "title": "VisaNews2U канал", "is_admin": False,
                 "error": "Бот не администратор канала — проверить подписку он не сможет"}

    fake_tg.chat_members[7000001] = "administrator"  # id бота из getMe
    r = (await client.get(url, params={"channel": "@visanewstoyou"})).json()
    assert r["ok"] is True and r["is_admin"] is True
