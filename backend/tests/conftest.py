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
from datetime import datetime, timezone  # noqa: E402

from aiogram.client.session.base import BaseSession  # noqa: E402
from aiogram.exceptions import TelegramAPIError  # noqa: E402
from aiogram.types import Chat, Document, Message, User, UserProfilePhotos, WebhookInfo  # noqa: E402
from sqlalchemy import delete  # noqa: E402

from database import AsyncSessionLocal, engine  # noqa: E402
from main import app  # noqa: E402
from modules.auth.models import User as AppUser, UserRole  # noqa: E402
from modules.auth.utils import create_access_token, hash_password  # noqa: E402
from modules.app_settings.models import AppSetting  # noqa: E402
from modules.bots import telegram  # noqa: E402


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class FakeSession(BaseSession):
    """HTTP-сессия aiogram без сети: записывает вызовы Bot API и отдаёт заготовленные ответы."""

    def __init__(self) -> None:
        super().__init__()
        self.calls: list[tuple[str, Any]] = []
        self.errors: dict[str, tuple[type[TelegramAPIError], str]] = {}
        self.me = User(id=7000001, is_bot=True, first_name="Visa Bot", username="visa_test_bot")
        self._n = 0

    async def make_request(self, bot, method, timeout=None):  # noqa: ANN001
        name = type(method).__name__
        self.calls.append((name, method))
        if name in self.errors:
            exc_cls, message = self.errors.pop(name)
            raise exc_cls(method=method, message=message)
        self._n += 1
        if name == "GetMe":
            return self.me
        if name == "GetWebhookInfo":
            return WebhookInfo(url="", has_custom_certificate=False, pending_update_count=0)
        if name == "GetUserProfilePhotos":
            return UserProfilePhotos(total_count=0, photos=[])
        if name in ("SendMessage", "SendDocument"):
            document = (
                Document(file_id=f"file-{self._n}", file_unique_id=f"u-{self._n}")
                if name == "SendDocument"
                else None
            )
            return Message(
                message_id=self._n,
                date=datetime.now(timezone.utc),
                chat=Chat(id=method.chat_id, type="private"),
                document=document,
            )
        return True

    async def stream_content(self, url, headers=None, timeout=30, chunk_size=65536, raise_for_status=True):  # noqa: ANN001
        yield b""

    async def close(self) -> None:
        pass

    def methods(self) -> list[str]:
        return [name for name, _ in self.calls]

    def sent(self, name: str) -> list[Any]:
        return [m for n, m in self.calls if n == name]

    def last(self, name: str) -> Any:
        return self.sent(name)[-1]


@pytest.fixture
def fake_tg(monkeypatch: pytest.MonkeyPatch) -> FakeSession:
    fake = FakeSession()
    monkeypatch.setattr(telegram, "_session", fake)
    return fake


@pytest.fixture
async def user():
    async with AsyncSessionLocal() as db:
        obj = AppUser(
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
        await db.execute(delete(AppUser).where(AppUser.id == obj.id))
        await db.execute(delete(AppSetting))  # настройки глобальные — чистим между тестами
        await db.commit()
    await engine.dispose()  # каждый тест — свой event loop


@pytest.fixture(autouse=True)
def media_root(tmp_path, monkeypatch: pytest.MonkeyPatch):
    from config import settings

    monkeypatch.setattr(settings, "media_root", str(tmp_path / "media"))
    return tmp_path / "media"


@pytest.fixture
async def client(user):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {create_access_token(user.id)}"},
    ) as c:
        yield c
