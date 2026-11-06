"""segment hall layouts

Revision ID: d776e4aa9cbd
Revises: d5a0802725d9
Create Date: 2026-11-02 17:25:11.497357

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d776e4aa9cbd"
down_revision: str | Sequence[str] | None = "d5a0802725d9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema.

    Сетка rows_count × seats_per_row уступает сегментной схеме: конфигурации
    зала, ценовые зоны, сидячие сектора и стоячие зоны. Старые места в новую
    модель не переносятся — зал, сеансы, брони и заказы очищаются, данные
    заново создаёт `python -m app.cli.seed`.
    """
    op.execute("TRUNCATE bookings, orders, sessions, seats")

    op.create_table(
        "hall_layouts",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("venue_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "description", sa.Text(), server_default=sa.text("''"), nullable=False
        ),
        sa.Column("canvas_width", sa.SmallInteger(), nullable=False),
        sa.Column("canvas_height", sa.SmallInteger(), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column(
            "is_archived", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "canvas_height > 0", name=op.f("ck_hall_layouts_canvas_height")
        ),
        sa.CheckConstraint(
            "canvas_width > 0", name=op.f("ck_hall_layouts_canvas_width")
        ),
        sa.CheckConstraint("position >= 0", name=op.f("ck_hall_layouts_position")),
        sa.ForeignKeyConstraint(
            ["venue_id"],
            ["venues.id"],
            name="fk_hall_layouts_venue",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_hall_layouts")),
    )
    op.create_table(
        "price_zones",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("layout_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["layout_id"],
            ["hall_layouts.id"],
            name="fk_price_zones_layout",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_price_zones")),
        sa.UniqueConstraint(
            "layout_id", "sort_order", name="uq_price_zones_layout_sort_order"
        ),
    )
    op.create_table(
        "sections",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("layout_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("shape", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.Column("generator", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("price_zone_id", sa.Uuid(), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "(kind = 'SEATED') = (generator IS NOT NULL)",
            name=op.f("ck_sections_seated_generator"),
        ),
        sa.CheckConstraint(
            "(kind = 'STANDING') = (price_zone_id IS NOT NULL AND capacity IS NOT NULL)",
            name=op.f("ck_sections_standing_fields"),
        ),
        sa.CheckConstraint(
            "kind IN ('SEATED', 'STANDING')", name=op.f("ck_sections_kind")
        ),
        sa.CheckConstraint("capacity > 0", name=op.f("ck_sections_capacity")),
        sa.ForeignKeyConstraint(
            ["layout_id"],
            ["hall_layouts.id"],
            name="fk_sections_layout",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["price_zone_id"],
            ["price_zones.id"],
            name="fk_sections_price_zone",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sections")),
    )
    op.create_table(
        "session_zone_prices",
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("price_zone_id", sa.Uuid(), nullable=False),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.CheckConstraint("price >= 0", name=op.f("ck_session_zone_prices_price")),
        sa.ForeignKeyConstraint(
            ["price_zone_id"],
            ["price_zones.id"],
            name="fk_session_zone_prices_price_zone",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.id"],
            name="fk_session_zone_prices_session",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "session_id", "price_zone_id", name=op.f("pk_session_zone_prices")
        ),
    )
    op.create_index("ix_hall_layouts_venue", "hall_layouts", ["venue_id", "position"])
    op.create_index("ix_sections_layout", "sections", ["layout_id"])

    op.add_column("seats", sa.Column("section_id", sa.Uuid(), nullable=False))
    op.add_column("seats", sa.Column("price_zone_id", sa.Uuid(), nullable=False))
    op.add_column("seats", sa.Column("unit_no", sa.Integer(), nullable=False))
    op.add_column("seats", sa.Column("row_label", sa.String(length=8), nullable=True))
    op.add_column("seats", sa.Column("seat_label", sa.String(length=8), nullable=True))
    op.add_column(
        "seats", sa.Column("x", sa.Numeric(precision=7, scale=1), nullable=True)
    )
    op.add_column(
        "seats", sa.Column("y", sa.Numeric(precision=7, scale=1), nullable=True)
    )
    op.drop_constraint(op.f("uq_seats_venue_row_seat"), "seats", type_="unique")
    op.create_unique_constraint(
        "uq_seats_section_unit_no", "seats", ["section_id", "unit_no"]
    )
    op.drop_constraint(op.f("fk_seats_venue"), "seats", type_="foreignkey")
    op.create_foreign_key(
        "fk_seats_section",
        "seats",
        "sections",
        ["section_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_seats_price_zone",
        "seats",
        "price_zones",
        ["price_zone_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_column("seats", "seat_no")
    op.drop_column("seats", "venue_id")
    op.drop_column("seats", "price_factor")
    op.drop_column("seats", "row_no")
    op.drop_column("seats", "price_category")
    op.create_check_constraint(op.f("ck_seats_unit_no"), "seats", "unit_no > 0")
    op.create_check_constraint(
        op.f("ck_seats_labels"), "seats", "(row_label IS NULL) = (seat_label IS NULL)"
    )
    op.create_index("ix_seats_price_zone", "seats", ["price_zone_id"])

    op.add_column("sessions", sa.Column("layout_id", sa.Uuid(), nullable=False))
    op.create_foreign_key(
        "fk_sessions_layout",
        "sessions",
        "hall_layouts",
        ["layout_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_sessions_layout", "sessions", ["layout_id"])

    op.drop_column("venues", "seats_per_row")
    op.drop_column("venues", "rows_count")


def downgrade() -> None:
    """Downgrade schema.

    Так же деструктивно, как upgrade: сетку из секторов не восстановить.
    """
    op.execute("TRUNCATE session_zone_prices, bookings, orders, sessions, seats")

    op.add_column("venues", sa.Column("rows_count", sa.SmallInteger(), nullable=True))
    op.add_column(
        "venues", sa.Column("seats_per_row", sa.SmallInteger(), nullable=True)
    )
    op.execute("UPDATE venues SET rows_count = 1, seats_per_row = 1")
    op.alter_column("venues", "rows_count", nullable=False)
    op.alter_column("venues", "seats_per_row", nullable=False)
    op.create_check_constraint(
        op.f("ck_venues_rows"), "venues", "rows_count BETWEEN 1 AND 100"
    )
    op.create_check_constraint(
        op.f("ck_venues_seats_per_row"), "venues", "seats_per_row BETWEEN 1 AND 100"
    )

    op.drop_index("ix_sessions_layout", table_name="sessions")
    op.drop_constraint("fk_sessions_layout", "sessions", type_="foreignkey")
    op.drop_column("sessions", "layout_id")

    op.drop_index("ix_seats_price_zone", table_name="seats")
    op.drop_constraint("fk_seats_price_zone", "seats", type_="foreignkey")
    op.drop_constraint("fk_seats_section", "seats", type_="foreignkey")
    op.drop_constraint("uq_seats_section_unit_no", "seats", type_="unique")
    op.drop_constraint(op.f("ck_seats_unit_no"), "seats", type_="check")
    op.drop_constraint(op.f("ck_seats_labels"), "seats", type_="check")
    for column in (
        "y",
        "x",
        "seat_label",
        "row_label",
        "unit_no",
        "price_zone_id",
        "section_id",
    ):
        op.drop_column("seats", column)
    op.add_column("seats", sa.Column("venue_id", sa.Uuid(), nullable=False))
    op.add_column("seats", sa.Column("row_no", sa.SmallInteger(), nullable=False))
    op.add_column("seats", sa.Column("seat_no", sa.SmallInteger(), nullable=False))
    op.add_column(
        "seats", sa.Column("price_category", sa.String(length=20), nullable=False)
    )
    op.add_column(
        "seats",
        sa.Column(
            "price_factor",
            sa.Numeric(precision=4, scale=2),
            server_default=sa.text("1.00"),
            nullable=False,
        ),
    )
    op.create_foreign_key(
        "fk_seats_venue", "seats", "venues", ["venue_id"], ["id"], ondelete="CASCADE"
    )
    op.create_unique_constraint(
        "uq_seats_venue_row_seat", "seats", ["venue_id", "row_no", "seat_no"]
    )
    op.create_check_constraint(op.f("ck_seats_row_no"), "seats", "row_no > 0")
    op.create_check_constraint(op.f("ck_seats_seat_no"), "seats", "seat_no > 0")
    op.create_check_constraint(
        op.f("ck_seats_price_category"),
        "seats",
        "price_category IN ('STALLS', 'BALCONY')",
    )
    op.create_check_constraint(
        op.f("ck_seats_price_factor"), "seats", "price_factor BETWEEN 0.10 AND 10.00"
    )

    op.drop_table("session_zone_prices")
    op.drop_table("sections")
    op.drop_table("price_zones")
    op.drop_table("hall_layouts")
