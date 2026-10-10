"""bots and bot subscribers

Revision ID: 0011
Revises: 0010
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tg_bot_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("first_name", sa.String(255), nullable=False),
        sa.Column("token_encrypted", sa.Text(), nullable=False),
        sa.Column("webhook_secret", sa.String(64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "webhook_status", sa.String(32), nullable=False, server_default="pending"
        ),
        sa.Column("webhook_error", sa.Text(), nullable=True),
        sa.Column("welcome_text", sa.Text(), nullable=False),
        sa.Column(
            "welcome_buttons", postgresql.JSON(), nullable=False, server_default="[]"
        ),
        sa.Column("last_update_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_bots_user_id", "bots", ["user_id"])

    op.create_table(
        "bot_subscribers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "bot_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tg_user_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(64), nullable=True),
        sa.Column("first_name", sa.String(255), nullable=True),
        sa.Column("last_name", sa.String(255), nullable=True),
        sa.Column("language_code", sa.String(16), nullable=True),
        sa.Column("source", sa.String(64), nullable=True),
        sa.Column(
            "is_blocked", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("bot_id", "tg_user_id"),
    )
    op.create_index("ix_bot_subscribers_bot_id", "bot_subscribers", ["bot_id"])
    op.create_index("ix_bot_subscribers_source", "bot_subscribers", ["source"])


def downgrade() -> None:
    op.drop_index("ix_bot_subscribers_source", table_name="bot_subscribers")
    op.drop_index("ix_bot_subscribers_bot_id", table_name="bot_subscribers")
    op.drop_table("bot_subscribers")
    op.drop_index("ix_bots_user_id", table_name="bots")
    op.drop_table("bots")
