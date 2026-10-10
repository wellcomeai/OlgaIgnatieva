"""Планировщик пауз воронок: фоновая задача внутри приложения.

Каждые 10 секунд забирает прохождения с истёкшей паузой. Строки
захватываются через FOR UPDATE SKIP LOCKED и сразу помечаются running —
несколько воркеров gunicorn не обработают одно прохождение дважды.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from database import AsyncSessionLocal
from modules.bots.service import tg_bot
from modules.flows.engine import resume_after_delay
from modules.flows.models import Flow, FlowRun, RunStatus
from modules.bots.models import Bot

logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 10
BATCH = 50


async def process_due_runs() -> int:
    async with AsyncSessionLocal() as db:
        runs = (
            await db.scalars(
                select(FlowRun)
                .where(FlowRun.status == RunStatus.WAITING_DELAY, FlowRun.wake_at <= datetime.now(timezone.utc))
                .order_by(FlowRun.wake_at)
                .limit(BATCH)
                .with_for_update(skip_locked=True)
            )
        ).all()
        for run in runs:
            run.status = RunStatus.RUNNING
        ids = [r.id for r in runs]
        await db.commit()

    for run_id in ids:
        async with AsyncSessionLocal() as db:
            run = await db.get(FlowRun, run_id)
            try:
                flow = await db.get(Flow, run.flow_id)
                bot_row = await db.get(Bot, flow.bot_id) if flow else None
                if bot_row is None:
                    run.status = RunStatus.CANCELLED
                else:
                    await resume_after_delay(tg_bot(bot_row), db, run)
                await db.commit()
            except Exception:
                logger.exception("Flow run %s failed after delay", run_id)
                await db.rollback()
                run = await db.get(FlowRun, run_id)
                if run is not None:
                    run.status = RunStatus.FAILED
                    run.error = "Внутренняя ошибка при продолжении после паузы"
                    await db.commit()
    return len(ids)


async def run_forever() -> None:
    while True:
        try:
            await process_due_runs()
        except Exception:
            logger.exception("Flow scheduler iteration failed")
        await asyncio.sleep(INTERVAL_SECONDS)
