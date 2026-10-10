"""Pydantic схемы для bots."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WelcomeButton(BaseModel):
    text: str = Field(min_length=1, max_length=64)
    url: str = Field(pattern=r"^(https?|tg)://\S+$", max_length=512)


class BotConnect(BaseModel):
    token: str = Field(min_length=1, max_length=128)


class BotUpdate(BaseModel):
    welcome_text: str | None = Field(default=None, min_length=1, max_length=4096)
    welcome_buttons: list[WelcomeButton] | None = Field(default=None, max_length=8)
    is_active: bool | None = None


class BotPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tg_bot_id: int
    username: str
    first_name: str
    is_active: bool
    webhook_status: str
    webhook_error: str | None = None
    welcome_text: str
    welcome_buttons: list[WelcomeButton]
    last_update_at: datetime | None = None
    created_at: datetime
    subscribers_count: int = 0


class WebhookInfo(BaseModel):
    url_set: bool
    pending_update_count: int = 0
    last_error_message: str | None = None
    last_error_date: datetime | None = None


class SubscriberPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tg_user_id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    language_code: str | None = None
    source: str | None = None
    is_blocked: bool
    created_at: datetime
    last_seen_at: datetime


class SubscriberPage(BaseModel):
    items: list[SubscriberPublic]
    total: int


class SourceStat(BaseModel):
    source: str | None
    count: int
