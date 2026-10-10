"""Исполнение воронок.

Прохождение (FlowRun) стоит на блоке `node_id`. `advance()` идёт по
стрелкам, выполняя блоки, пока не встретит ожидание: пауза (wake_at,
будит планировщик), кнопки-ветки (ждём нажатия) или вопрос (ждём ответа).
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from aiogram import Bot as TgBot
from aiogram.exceptions import TelegramForbiddenError
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from modules.bots.messaging import render_template, send_text
from modules.bots.models import Bot, Subscriber
from modules.bots.telegram import TelegramAPIError
from modules.flows import graph as g
from modules.flows.models import Flow, FlowEvent, FlowRun, RunStatus
from modules.shop.models import Order, OrderStatus

logger = logging.getLogger(__name__)

MAX_STEPS = 40
FLOW_CALLBACK = "fl:"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def button_callback(run: FlowRun, btn_id: str) -> str:
    return f"{FLOW_CALLBACK}{run.id.hex}:{btn_id}"  # ≤ 3+32+1+12 = 48 байт


def parse_callback(data: str) -> tuple[uuid.UUID, str] | None:
    try:
        run_hex, btn_id = data[len(FLOW_CALLBACK):].split(":", 1)
        return uuid.UUID(hex=run_hex), btn_id
    except ValueError:
        return None


def _markup(run: FlowRun, data: dict[str, Any]) -> InlineKeyboardMarkup | None:
    rows = []
    for b in data.get("buttons") or []:
        if b["type"] == "url":
            rows.append([InlineKeyboardButton(text=b["text"], url=b["url"])])
        else:
            rows.append([InlineKeyboardButton(text=b["text"], callback_data=button_callback(run, b["id"]))])
    return InlineKeyboardMarkup(inline_keyboard=rows) if rows else None


async def _purchased(db: AsyncSession, sub: Subscriber, product_id: str | None) -> bool:
    if not product_id:
        return False
    try:
        pid = uuid.UUID(product_id)
    except ValueError:
        return False
    return bool(
        await db.scalar(
            select(func.count()).where(
                Order.subscriber_id == sub.id, Order.product_id == pid, Order.status == OrderStatus.PAID
            )
        )
    )


async def _condition(db: AsyncSession, sub: Subscriber, d: dict[str, Any]) -> bool:
    kind = d.get("kind")
    if kind == "purchased":
        return await _purchased(db, sub, d.get("product_id"))
    if kind == "has_tag":
        return (d.get("tag") or "").strip().lower() in [t.lower() for t in sub.tags or []]
    if kind == "has_var":
        return bool((sub.vars or {}).get(d.get("var") or ""))
    return False


def _set_tag(sub: Subscriber, tag: str, add: bool) -> None:
    tag = tag.strip()
    current = [t for t in (sub.tags or []) if t.lower() != tag.lower()]
    sub.tags = current + [tag] if add else current


async def _product(db: AsyncSession, bot_row: Bot, product_id: str | None):
    from modules.shop.offers import product_for_bot

    try:
        return await product_for_bot(db, bot_row, uuid.UUID(str(product_id)))
    except ValueError:
        return None


async def advance(
    tg: TgBot, db: AsyncSession, bot_row: Bot, sub: Subscriber, flow: Flow, run: FlowRun, handle: str
) -> None:
    """Идти по стрелкам от текущего блока через выход `handle`."""
    from modules.shop.delivery import send_product
    from modules.shop.offers import send_offer

    nodes = g.node_map(flow.graph)
    run.status = RunStatus.RUNNING
    run.wake_at = None
    for _ in range(MAX_STEPS):
        target = g.outgoing(flow.graph, run.node_id, handle)
        node = nodes.get(target) if target else None
        if node is None:
            run.status = RunStatus.FINISHED
            return
        run.node_id = node["id"]
        db.add(FlowEvent(flow_id=flow.id, node_id=node["id"], subscriber_id=sub.id))
        t, d = node["type"], node.get("data") or {}
        handle = "next"

        if t == "message":
            await send_text(tg, sub.tg_user_id, render_template(d.get("text", ""), sub), reply_markup=_markup(run, d))
            if g.next_buttons(d):
                run.status = RunStatus.WAITING_CLICK
                return
        elif t == "delay":
            run.status = RunStatus.WAITING_DELAY
            run.wake_at = datetime.now(timezone.utc) + timedelta(seconds=g.delay_seconds(d))
            return
        elif t == "question":
            await send_text(tg, sub.tg_user_id, render_template(d.get("text", ""), sub))
            run.status = RunStatus.WAITING_INPUT
            return
        elif t == "offer":
            product = await _product(db, bot_row, d.get("product_id"))
            if product is not None:
                await send_offer(tg, db, bot_row, sub, product)
        elif t == "files":
            product = await _product(db, bot_row, d.get("product_id"))
            if product is not None:
                await send_product(tg, db, bot_row, sub, product, with_message=False)
        elif t == "condition":
            handle = "yes" if await _condition(db, sub, d) else "no"
        elif t == "tag":
            _set_tag(sub, d.get("tag") or "", d.get("action") == "add")

    run.status = RunStatus.FAILED
    run.error = f"Больше {MAX_STEPS} шагов подряд без ожидания — похоже на зацикливание"


async def _safe(coro_factory, run: FlowRun, sub: Subscriber) -> None:
    """Выполнить шаги; ошибка Telegram завершает прохождение, а не всю обработку апдейта."""
    try:
        await coro_factory()
    except TelegramForbiddenError:
        sub.is_blocked = True
        run.status = RunStatus.FAILED
        run.error = "Подписчик заблокировал бота"
    except TelegramAPIError as exc:
        logger.warning("Flow run %s failed: %s", run.id, exc.message)
        run.status = RunStatus.FAILED
        run.error = exc.message


async def start_flow(tg: TgBot, db: AsyncSession, bot_row: Bot, sub: Subscriber, flow: Flow) -> FlowRun:
    """Запустить воронку для подписчика (заново, если он уже в ней)."""
    await db.execute(
        update(FlowRun)
        .where(FlowRun.flow_id == flow.id, FlowRun.subscriber_id == sub.id, FlowRun.status.in_(RunStatus.ACTIVE))
        .values(status=RunStatus.CANCELLED, wake_at=None)
    )
    trigger = g.trigger_node(flow.graph)
    run = FlowRun(flow_id=flow.id, subscriber_id=sub.id, node_id=trigger["id"], status=RunStatus.RUNNING)
    db.add(run)
    await db.flush()
    db.add(FlowEvent(flow_id=flow.id, node_id=trigger["id"], subscriber_id=sub.id))
    await _safe(lambda: advance(tg, db, bot_row, sub, flow, run, "next"), run, sub)
    return run


# ---- триггеры ------------------------------------------------------------

async def _active_flows(db: AsyncSession, bot_row: Bot, kind: str) -> list[Flow]:
    return list(
        (
            await db.scalars(
                select(Flow)
                .where(Flow.bot_id == bot_row.id, Flow.is_active.is_(True), Flow.trigger_kind == kind)
                .order_by(Flow.created_at)
            )
        ).all()
    )


async def flow_for_start(db: AsyncSession, bot_row: Bot, payload: str | None) -> Flow | None:
    """/start: воронка с этой меткой, иначе воронка на любой /start."""
    if payload:
        for flow in await _active_flows(db, bot_row, "start_label"):
            if flow.trigger_value == payload:
                return flow
    flows = await _active_flows(db, bot_row, "start")
    return flows[0] if flows else None


async def flow_for_keyword(db: AsyncSession, bot_row: Bot, text: str) -> Flow | None:
    low = text.lower()
    for flow in await _active_flows(db, bot_row, "keyword"):
        if flow.trigger_value and flow.trigger_value.lower() in low:
            return flow
    return None


async def flows_for_purchase(db: AsyncSession, bot_row: Bot, product_id: uuid.UUID) -> list[Flow]:
    return [f for f in await _active_flows(db, bot_row, "purchase") if f.trigger_value == str(product_id)]


# ---- события подписчика --------------------------------------------------

async def handle_button(
    tg: TgBot, db: AsyncSession, bot_row: Bot, sub: Subscriber, run_id: uuid.UUID, btn_id: str
) -> bool:
    """Нажата кнопка-ветка. False — кнопка устарела (воронка ушла дальше или выключена)."""
    run = await db.get(FlowRun, run_id)
    if run is None or run.subscriber_id != sub.id or run.status != RunStatus.WAITING_CLICK:
        return False
    flow = await db.get(Flow, run.flow_id)
    if flow is None or not flow.is_active or flow.bot_id != bot_row.id:
        return False
    node = g.node_map(flow.graph).get(run.node_id)
    if node is None or btn_id not in {b["id"] for b in g.next_buttons(node.get("data") or {})}:
        return False
    await _safe(lambda: advance(tg, db, bot_row, sub, flow, run, f"btn:{btn_id}"), run, sub)
    return True


def _valid_answer(kind: str, text: str) -> bool:
    if kind == "email":
        return bool(EMAIL_RE.match(text))
    if kind == "phone":
        return len(re.sub(r"\D", "", text)) >= 10
    return bool(text)


async def handle_text(tg: TgBot, db: AsyncSession, bot_row: Bot, sub: Subscriber, text: str) -> bool:
    """Ответ на вопрос воронки. False — подписчик ни на что не отвечает."""
    run = await db.scalar(
        select(FlowRun)
        .join(Flow, Flow.id == FlowRun.flow_id)
        .where(
            FlowRun.subscriber_id == sub.id,
            FlowRun.status == RunStatus.WAITING_INPUT,
            Flow.bot_id == bot_row.id,
            Flow.is_active.is_(True),
        )
        .order_by(FlowRun.updated_at.desc())
        .limit(1)
    )
    if run is None:
        return False
    flow = await db.get(Flow, run.flow_id)
    node = g.node_map(flow.graph).get(run.node_id) if flow else None
    if node is None or node["type"] != "question":
        run.status = RunStatus.FINISHED
        return False
    d = node.get("data") or {}
    answer = text.strip()[:500]
    kind = d.get("validate", "any")
    if not _valid_answer(kind, answer):
        hint = {"email": "Похоже, это не email. Напишите, пожалуйста, ещё раз — например, name@mail.ru",
                "phone": "Похоже, это не номер телефона. Напишите, пожалуйста, ещё раз — например, +7 900 123-45-67"}
        await send_text(tg, sub.tg_user_id, hint.get(kind, "Напишите, пожалуйста, ответ текстом"))
        return True
    sub.vars = {**(sub.vars or {}), d["var"]: answer}
    await _safe(lambda: advance(tg, db, bot_row, sub, flow, run, "next"), run, sub)
    return True


async def resume_after_delay(tg: TgBot, db: AsyncSession, run: FlowRun) -> None:
    """Пауза закончилась (вызывает планировщик)."""
    flow = await db.get(Flow, run.flow_id)
    sub = await db.get(Subscriber, run.subscriber_id)
    bot_row = await db.get(Bot, flow.bot_id) if flow else None
    if flow is None or sub is None or bot_row is None or not flow.is_active or not bot_row.is_active:
        run.status = RunStatus.CANCELLED
        return
    await _safe(lambda: advance(tg, db, bot_row, sub, flow, run, "next"), run, sub)
