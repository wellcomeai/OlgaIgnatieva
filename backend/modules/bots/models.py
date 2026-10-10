"""Bot, Subscriber."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

DEFAULT_WELCOME_TEXT = (
    "Здравствуйте, {first_name}! 👋\n\n"
    "Рада видеть вас здесь. Скоро здесь появятся полезные материалы."
)


class WebhookStatus:
    PENDING = "pending"
    OK = "ok"
    ERROR = "error"
    NO_HTTPS = "no_https"
    DISABLED = "disabled"


class Bot(Base):
    __tablename__ = "bots"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tg_bot_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    webhook_secret: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    webhook_status: Mapped[str] = mapped_column(
        String(32), default=WebhookStatus.PENDING, nullable=False
    )
    webhook_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    welcome_text: Mapped[str] = mapped_column(
        Text, default=DEFAULT_WELCOME_TEXT, nullable=False
    )
    # [{"text": "...", "url": "https://..."}]
    welcome_buttons: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    # id продуктов (str), кнопки «Купить» которых показываются в приветствии
    welcome_product_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    last_update_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Subscriber(Base):
    """Пользователь Telegram, написавший боту."""

    __tablename__ = "bot_subscribers"
    __table_args__ = (UniqueConstraint("bot_id", "tg_user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    bot_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("bots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tg_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    language_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # Метка из ссылки t.me/<bot>?start=<source> при первом входе
    source: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
