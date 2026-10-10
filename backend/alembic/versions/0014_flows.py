"""flows: funnels, runs, events; subscriber tags and vars

Revision ID: 0014
Revises: 0013
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels = None
depends_on = None


def _ts(name: str) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())


def _fk(name: str, table: str) -> sa.Column:
    return sa.Column(
        name, postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{table}.id", ondelete="CASCADE"), nullable=False
    )


def upgrade() -> None:
    op.add_column("bot_subscribers", sa.Column("tags", postgresql.JSON(), nullable=False, server_default="[]"))
    op.add_column("bot_subscribers", sa.Column("vars", postgresql.JSON(), nullable=False, server_default="{}"))

    op.create_table(
        "flows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _fk("bot_id", "bots"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("graph", postgresql.JSON(), nullable=False),
        sa.Column("trigger_kind", sa.String(32), nullable=False),
        sa.Column("trigger_value", sa.String(255), nullable=False, server_default=""),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_flows_bot_id", "flows", ["bot_id"])

    op.create_table(
        "flow_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _fk("flow_id", "flows"),
        _fk("subscriber_id", "bot_subscribers"),
        sa.Column("node_id", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("wake_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_flow_runs_flow_id", "flow_runs", ["flow_id"])
    op.create_index("ix_flow_runs_subscriber_id", "flow_runs", ["subscriber_id"])
    op.create_index("ix_flow_runs_status", "flow_runs", ["status"])
    op.create_index("ix_flow_runs_wake_at", "flow_runs", ["wake_at"])

    op.create_table(
        "flow_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _fk("flow_id", "flows"),
        sa.Column("node_id", sa.String(32), nullable=False),
        _fk("subscriber_id", "bot_subscribers"),
        _ts("created_at"),
    )
    op.create_index("ix_flow_events_flow_id", "flow_events", ["flow_id"])


def downgrade() -> None:
    op.drop_table("flow_events")
    op.drop_table("flow_runs")
    op.drop_table("flows")
    op.drop_column("bot_subscribers", "vars")
    op.drop_column("bot_subscribers", "tags")
