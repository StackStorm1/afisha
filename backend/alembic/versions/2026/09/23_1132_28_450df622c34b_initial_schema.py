"""initial schema

Revision ID: 450df622c34b
Revises:
Create Date: 2026-09-23 11:32:28.331113

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "450df622c34b"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")

    op.create_table(
        "categories",
        sa.Column("id", sa.SmallInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.CheckConstraint(
            "code IN ('CONCERT', 'THEATRE', 'STANDUP', 'FESTIVAL')",
            name=op.f("ck_categories_code"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
        sa.UniqueConstraint("code", name="uq_categories_code"),
        sa.UniqueConstraint("name", name="uq_categories_name"),
        sa.UniqueConstraint("slug", name="uq_categories_slug"),
    )
    op.create_table(
        "cities",
        sa.Column("id", sa.SmallInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cities")),
        sa.UniqueConstraint("name", name="uq_cities_name"),
        sa.UniqueConstraint("slug", name="uq_cities_slug"),
    )
    op.create_table(
        "users",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("email", postgresql.CITEXT(), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.String(length=20),
            server_default=sa.text("'VISITOR'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("role IN ('VISITOR', 'ADMIN')", name=op.f("ck_users_role")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_table(
        "events",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category_id", sa.SmallInteger(), nullable=False),
        sa.Column("age_rating", sa.String(length=3), nullable=False),
        sa.Column("poster_url", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "age_rating IN ('0+', '6+', '12+', '16+', '18+')",
            name=op.f("ck_events_age_rating"),
        ),
        sa.CheckConstraint(
            "length(btrim(title)) > 0", name=op.f("ck_events_title_not_blank")
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name="fk_events_category",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_events")),
    )
    op.create_table(
        "venues",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("city_id", sa.SmallInteger(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=False),
        sa.Column("rows_count", sa.SmallInteger(), nullable=False),
        sa.Column("seats_per_row", sa.SmallInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("rows_count BETWEEN 1 AND 100", name=op.f("ck_venues_rows")),
        sa.CheckConstraint(
            "seats_per_row BETWEEN 1 AND 100", name=op.f("ck_venues_seats_per_row")
        ),
        sa.ForeignKeyConstraint(
            ["city_id"], ["cities.id"], name="fk_venues_city", ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_venues")),
        sa.UniqueConstraint("city_id", "name", name="uq_venues_city_name"),
    )
    op.create_table(
        "favorites",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["event_id"], ["events.id"], name="fk_favorites_event", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_favorites_user", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "event_id", name=op.f("pk_favorites")),
    )
    op.create_table(
        "seats",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("venue_id", sa.Uuid(), nullable=False),
        sa.Column("row_no", sa.SmallInteger(), nullable=False),
        sa.Column("seat_no", sa.SmallInteger(), nullable=False),
        sa.Column("price_category", sa.String(length=20), nullable=False),
        sa.Column(
            "price_factor",
            sa.Numeric(precision=4, scale=2),
            server_default=sa.text("1.00"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "price_category IN ('STALLS', 'BALCONY')",
            name=op.f("ck_seats_price_category"),
        ),
        sa.CheckConstraint(
            "price_factor BETWEEN 0.10 AND 10.00", name=op.f("ck_seats_price_factor")
        ),
        sa.CheckConstraint("row_no > 0", name=op.f("ck_seats_row_no")),
        sa.CheckConstraint("seat_no > 0", name=op.f("ck_seats_seat_no")),
        sa.ForeignKeyConstraint(
            ["venue_id"], ["venues.id"], name="fk_seats_venue", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_seats")),
        sa.UniqueConstraint(
            "venue_id", "row_no", "seat_no", name="uq_seats_venue_row_seat"
        ),
    )
    op.create_table(
        "sessions",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("venue_id", sa.Uuid(), nullable=False),
        sa.Column("city_id", sa.SmallInteger(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("base_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("seats_total", sa.Integer(), nullable=False),
        sa.Column("seats_available", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'ACTIVE'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('ACTIVE', 'CANCELLED', 'COMPLETED')",
            name=op.f("ck_sessions_status"),
        ),
        sa.CheckConstraint("base_price >= 0", name=op.f("ck_sessions_base_price")),
        sa.CheckConstraint(
            "seats_available BETWEEN 0 and seats_total",
            name=op.f("ck_sessions_seats_available"),
        ),
        sa.CheckConstraint("seats_total > 0", name=op.f("ck_sessions_seats_total")),
        sa.ForeignKeyConstraint(
            ["city_id"], ["cities.id"], name="fk_sessions_city", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["event_id"], ["events.id"], name="fk_sessions_event", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["venue_id"], ["venues.id"], name="fk_sessions_venue", ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sessions")),
        sa.UniqueConstraint(
            "venue_id", "starts_at", name="uq_sessions_venue_starts_at"
        ),
    )
    op.create_table(
        "orders",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("total_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'PENDING'"),
            nullable=False,
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(status = 'PAID') = (paid_at IS NOT NULL)", name=op.f("ck_orders_paid_at")
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')",
            name=op.f("ck_orders_status"),
        ),
        sa.CheckConstraint("total_price >= 0", name=op.f("ck_orders_total_price")),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.id"],
            name="fk_orders_session",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_orders_user", ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_orders")),
    )
    op.create_table(
        "bookings",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("seat_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=True),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(status = 'HELD') = (expires_at IS NOT NULL)",
            name=op.f("ck_bookings_expires_at"),
        ),
        sa.CheckConstraint(
            "status IN ('HELD', 'PAID', 'EXPIRED', 'CANCELLED')",
            name=op.f("ck_bookings_status"),
        ),
        sa.CheckConstraint("price >= 0", name=op.f("ck_bookings_price")),
        sa.ForeignKeyConstraint(
            ["order_id"], ["orders.id"], name="fk_bookings_order", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["seat_id"], ["seats.id"], name="fk_bookings_seat", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.id"],
            name="fk_bookings_session",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_bookings_user", ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_bookings")),
    )
    op.create_index(
        "uq_bookings_active_seat",
        "bookings",
        ["session_id", "seat_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('HELD', 'PAID')"),
    )
    # ### end Alembic commands ###

    op.create_index(
        "ix_sessions_city_starts_at",
        "sessions",
        ["city_id", "starts_at"],
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
    op.create_index(
        "ix_sessions_event_starts_at",
        "sessions",
        ["event_id", "starts_at"],
    )
    op.create_index(
        "ix_events_fts",
        "events",
        [sa.text("to_tsvector('russian', title || ' ' || coalesce(description, ''))")],
        postgresql_using="gin",
    )
    op.create_index("ix_events_category_id", "events", ["category_id"])
    op.create_index(
        "ix_bookings_session_active",
        "bookings",
        ["session_id"],
        postgresql_where=sa.text("status IN ('HELD', 'PAID')"),
    )
    op.create_index(
        "ix_bookings_expiry",
        "bookings",
        ["expires_at"],
        postgresql_where=sa.text("status = 'HELD'"),
    )
    op.create_index(
        "ix_bookings_order",
        "bookings",
        ["order_id"],
        postgresql_where=sa.text("order_id IS NOT NULL"),
    )
    op.create_index(
        "ix_orders_user_created",
        "orders",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index("ix_orders_session", "orders", ["session_id"])

    op.execute(
        """
        CREATE FUNCTION set_updated_at() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$
        """
    )
    for table in ("users", "events", "sessions", "orders"):
        op.execute(
            f"""
            CREATE TRIGGER trg_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION set_updated_at()
            """
        )

    op.execute(
        """
        CREATE FUNCTION sessions_sync_city() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            SELECT venues.city_id INTO NEW.city_id
            FROM venues
            WHERE venues.id = NEW.venue_id;
            RETURN NEW;
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_sessions_sync_city
        BEFORE INSERT OR UPDATE OF venue_id ON sessions
        FOR EACH ROW EXECUTE FUNCTION sessions_sync_city()
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(
        "uq_bookings_active_seat",
        table_name="bookings",
        postgresql_where=sa.text("status IN ('HELD', 'PAID')"),
    )
    op.drop_table("bookings")
    op.drop_table("orders")
    op.drop_table("sessions")
    op.drop_table("seats")
    op.drop_table("favorites")
    op.drop_table("venues")
    op.drop_table("events")
    op.drop_table("users")
    op.drop_table("cities")
    op.drop_table("categories")
    # ### end Alembic commands ###

    op.execute("DROP FUNCTION IF EXISTS sessions_sync_city()")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at()")
