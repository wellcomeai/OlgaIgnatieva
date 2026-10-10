"""Pydantic схемы воронок."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class FlowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    template: Literal["blank", "welcome_sale", "lead_magnet"] = "blank"


class FlowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    graph: dict[str, Any] | None = None
    is_active: bool | None = None


class FlowSummary(BaseModel):
    id: UUID
    bot_id: UUID
    name: str
    is_active: bool
    trigger_kind: str
    trigger_value: str
    created_at: datetime
    updated_at: datetime
    entered: int = 0      # сколько людей вошло в воронку
    in_progress: int = 0  # сколько сейчас ждут паузы/кнопки/ответа


class FlowDetail(FlowSummary):
    graph: dict[str, Any]
    node_stats: dict[str, int] = {}  # node_id → сколько людей дошло
    problems: list[str] = []         # что мешает включить воронку
