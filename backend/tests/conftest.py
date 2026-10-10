"""Тесты гоняются против настоящего PostgreSQL из DATABASE_URL
(миграции должны быть применены: `alembic upgrade head`)."""
from __future__ import annotations

import sys
import uuid
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402
from sqlalchemy import delete  # noqa: E402

from database import AsyncSessionLocal, engine  # noqa: E402
from main import app  # noqa: E402
from modules.auth.models import User, UserRole  # noqa: E402
from modules.auth.utils import create_access_token, hash_password  # noqa: E402
from modules.bots import telegram  # noqa: E402


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class FakeTelegram:
    """Подменяет telegram.call: записывает вызовы и отдаёт заготовленные ответы."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict[str, Any]]] = []
        self.errors: dict[str, telegram.TelegramError] = {}
        self.me = {"id": 7000001, "is_bot": True, "first_name": "Visa Bot", "username": "visa_test_bot"}

    async def call(self, token: str, method: str, **params: Any) -> Any:
        self.calls.append((token, method, params))
        if method in self.errors:
            raise self.errors.pop(method)
        if method == "getMe":
            return self.me
        if method == "sendMessage":
            return {"message_id": len(self.calls)}
        if method == "getWebhookInfo":
            return {"url": "", "pending_update_count": 0}
        return True

    def methods(self) -> list[str]:
        return [m for _, m, _ in self.calls]


@pytest.fixture
def fake_tg(monkeypatch: pytest.MonkeyPatch) -> FakeTelegram:
    fake = FakeTelegram()
    monkeypatch.setattr(telegram, "call", fake.call)
    return fake


@pytest.fixture
async def user():
    async with AsyncSessionLocal() as db:
        obj = User(
            email=f"owner-{uuid.uuid4().hex[:8]}@example.com",
            hashed_password=hash_password("secret123"),
            role=UserRole.ADMIN,
            is_active=True,
            is_email_verified=True,
        )
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
    yield obj
    async with AsyncSessionLocal() as db:
        await db.execute(delete(User).where(User.id == obj.id))
        await db.commit()
    await engine.dispose()  # каждый тест — свой event loop


@pytest.fixture
async def client(user):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {create_access_token(user.id)}"},
    ) as c:
        yield c
