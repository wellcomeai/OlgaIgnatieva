"""Воронки: операции кабинета."""
from __future__ import annotations

import uuid
from typing import Sequence

from fastapi import HTTPException
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.auth.models import User
from modules.bots.models import Bot
from modules.flows import graph as g
from modules.flows.models import Flow, FlowEvent, FlowRun, RunStatus
from modules.flows.schemas import FlowCreate, FlowDetail, FlowSummary, FlowUpdate
from modules.flows.templates import TEMPLATES
from modules.shop.models import Product

TRIGGER_TITLES = {
    "start": "любой /start",
    "start_label": "/start с меткой",
    "keyword": "ключевое слово",
    "purchase": "после оплаты",
}


async def _bot(db: AsyncSession, user: User, bot_id: uuid.UUID) -> Bot:
    bot = await db.get(Bot, bot_id)
    if bot is None or bot.user_id != user.id:
        raise HTTPException(status_code=404, detail="Бот не найден")
    return bot


async def get_flow(db: AsyncSession, user: User, flow_id: uuid.UUID) -> Flow:
    flow = await db.get(Flow, flow_id)
    if flow is None:
        raise HTTPException(status_code=404, detail="Воронка не найдена")
    await _bot(db, user, flow.bot_id)
    return flow


async def _product_ids(db: AsyncSession, user: User) -> set[str]:
    ids = (await db.scalars(select(Product.id).where(Product.user_id == user.id))).all()
    return {str(i) for i in ids}


async def _counts(db: AsyncSession, flow_ids: list[uuid.UUID]) -> tuple[dict, dict]:
    if not flow_ids:
        return {}, {}
    entered = await db.execute(
        select(FlowRun.flow_id, func.count(distinct(FlowRun.subscriber_id)))
        .where(FlowRun.flow_id.in_(flow_ids))
        .group_by(FlowRun.flow_id)
    )
    active = await db.execute(
        select(FlowRun.flow_id, func.count())
        .where(FlowRun.flow_id.in_(flow_ids), FlowRun.status.in_(RunStatus.ACTIVE))
        .group_by(FlowRun.flow_id)
    )
    return dict(entered.all()), dict(active.all())


def _summary(flow: Flow, entered: dict, active: dict) -> FlowSummary:
    return FlowSummary(
        id=flow.id, bot_id=flow.bot_id, name=flow.name, is_active=flow.is_active,
        trigger_kind=flow.trigger_kind, trigger_value=flow.trigger_value,
        created_at=flow.created_at, updated_at=flow.updated_at,
        entered=entered.get(flow.id, 0), in_progress=active.get(flow.id, 0),
    )


async def list_flows(db: AsyncSession, user: User, bot_id: uuid.UUID) -> list[FlowSummary]:
    bot = await _bot(db, user, bot_id)
    flows: Sequence[Flow] = (
        await db.scalars(select(Flow).where(Flow.bot_id == bot.id).order_by(Flow.created_at))
    ).all()
    entered, active = await _counts(db, [f.id for f in flows])
    return [_summary(f, entered, active) for f in flows]


async def detail(db: AsyncSession, user: User, flow: Flow) -> FlowDetail:
    entered, active = await _counts(db, [flow.id])
    stats = await db.execute(
        select(FlowEvent.node_id, func.count(distinct(FlowEvent.subscriber_id)))
        .where(FlowEvent.flow_id == flow.id)
        .group_by(FlowEvent.node_id)
    )
    problems = g.validate(flow.graph, await _product_ids(db, user)).problems
    return FlowDetail(
        **_summary(flow, entered, active).model_dump(),
        graph=flow.graph,
        node_stats=dict(stats.all()),
        problems=problems,
    )


async def create_flow(db: AsyncSession, user: User, bot_id: uuid.UUID, payload: FlowCreate) -> Flow:
    bot = await _bot(db, user, bot_id)
    graph = TEMPLATES[payload.template]()
    v = g.validate(graph, set())
    flow = Flow(
        bot_id=bot.id, name=payload.name.strip(), is_active=False, graph=graph,
        trigger_kind=v.trigger_kind, trigger_value=v.trigger_value,
    )
    db.add(flow)
    await db.commit()
    await db.refresh(flow)
    return flow


async def _check_trigger_conflict(db: AsyncSession, flow: Flow) -> None:
    """Две активные воронки с одинаковым стартом — непредсказуемо, запрещаем."""
    if flow.trigger_kind not in ("start", "start_label"):
        return
    other = await db.scalar(
        select(Flow).where(
            Flow.bot_id == flow.bot_id,
            Flow.id != flow.id,
            Flow.is_active.is_(True),
            Flow.trigger_kind == flow.trigger_kind,
            Flow.trigger_value == flow.trigger_value,
        )
    )
    if other is not None:
        what = "на любой /start" if flow.trigger_kind == "start" else f"с меткой «{flow.trigger_value}»"
        raise HTTPException(
            status_code=409,
            detail=f"Уже включена воронка «{other.name}» {what}. Выключите её или выберите другой старт.",
        )


async def update_flow(db: AsyncSession, user: User, flow: Flow, payload: FlowUpdate) -> Flow:
    if payload.name is not None:
        flow.name = payload.name.strip()
    product_ids = await _product_ids(db, user)
    if payload.graph is not None:
        try:
            v = g.validate(payload.graph, product_ids)
        except g.GraphError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        flow.graph = payload.graph
        flow.trigger_kind, flow.trigger_value = v.trigger_kind, v.trigger_value
    if payload.is_active is not None:
        flow.is_active = payload.is_active
    if flow.is_active:
        problems = g.validate(flow.graph, product_ids).problems
        if problems:
            raise HTTPException(status_code=422, detail="Чтобы включить воронку: " + "; ".join(problems))
        await _check_trigger_conflict(db, flow)
    await db.commit()
    await db.refresh(flow)
    return flow


async def delete_flow(db: AsyncSession, flow: Flow) -> None:
    await db.delete(flow)
    await db.commit()


async def active_start_flow_name(db: AsyncSession, bot: Bot) -> str | None:
    """Имя воронки, которая заменяет приветствие (для подсказки в кабинете)."""
    return await db.scalar(
        select(Flow.name).where(Flow.bot_id == bot.id, Flow.is_active.is_(True), Flow.trigger_kind == "start")
    )
