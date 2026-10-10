"""Воронки (internal)."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import CurrentUser
from modules.flows import service
from modules.flows.schemas import FlowCreate, FlowDetail, FlowSummary, FlowUpdate

router = APIRouter(tags=["flows"])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("/bots/{bot_id}/flows", response_model=list[FlowSummary])
async def list_flows(bot_id: UUID, user: CurrentUser, db: Db):
    return await service.list_flows(db, user, bot_id)


@router.post("/bots/{bot_id}/flows", response_model=FlowDetail, status_code=status.HTTP_201_CREATED)
async def create_flow(bot_id: UUID, payload: FlowCreate, user: CurrentUser, db: Db):
    flow = await service.create_flow(db, user, bot_id, payload)
    return await service.detail(db, user, flow)


@router.get("/flows/{flow_id}", response_model=FlowDetail)
async def get_flow(flow_id: UUID, user: CurrentUser, db: Db):
    return await service.detail(db, user, await service.get_flow(db, user, flow_id))


@router.put("/flows/{flow_id}", response_model=FlowDetail)
async def update_flow(flow_id: UUID, payload: FlowUpdate, user: CurrentUser, db: Db):
    flow = await service.get_flow(db, user, flow_id)
    flow = await service.update_flow(db, user, flow, payload)
    return await service.detail(db, user, flow)


@router.delete("/flows/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow(flow_id: UUID, user: CurrentUser, db: Db):
    await service.delete_flow(db, await service.get_flow(db, user, flow_id))
    return None
