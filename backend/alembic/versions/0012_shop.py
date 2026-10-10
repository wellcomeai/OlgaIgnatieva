"""products, product files, orders; bot welcome products

Revision ID: 0012
Revises: 0011
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels = None
depends_on = None


def _ts(name: str) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())


def upgrade() -> None:
    op.add_column(
        "bots",
        sa.Column("welcome_product_ids", postgresql.JSON(), nullable=False, server_default="[]"),
    )

    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("delivery_message", sa.Text(), nullable=False),
        sa.Column("protect_content", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_products_user_id", "products", ["user_id"])

    op.create_table(
        "product_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(127), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("storage_name", sa.String(255), nullable=False),
        sa.Column("tg_file_ids", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        _ts("created_at"),
    )
    op.create_index("ix_product_files_product_id", "product_files", ["product_id"])

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "inv_id",
            sa.BigInteger(),
            sa.Identity(start=100001),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "bot_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bots.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "subscriber_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bot_subscribers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("product_title", sa.String(255), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_error", sa.Text(), nullable=True),
        _ts("created_at"),
    )
    op.create_index("ix_orders_user_id", "orders", ["user_id"])
    op.create_index("ix_orders_subscriber_id", "orders", ["subscriber_id"])
    op.create_index("ix_orders_product_id", "orders", ["product_id"])
    op.create_index("ix_orders_status", "orders", ["status"])


def downgrade() -> None:
    op.drop_table("orders")
    op.drop_table("product_files")
    op.drop_table("products")
    op.drop_column("bots", "welcome_product_ids")
