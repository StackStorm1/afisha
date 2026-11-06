from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from app.schemas.auth import AuthResponse, AuthResponseData, UserProfile, UserRole
from app.schemas.categories import Category, CategoryCode
from app.schemas.cities import City
from app.schemas.events import AgeRating, EventBase, EventDetail, EventSummary
from app.schemas.orders import (
    BookedSeat,
    BookedSection,
    BookedZone,
    OrderDetail,
    OrderEventRef,
    OrderSessionRef,
    OrderStatus,
    OrderVenueRef,
)
from app.schemas.primitives import Pagination
from app.schemas.sessions import Session, SessionStatus
from app.schemas.venues import Venue

# ─── IDs ─────────────────────────────────────────────────────────────────────

USER_ID = UUID("a1b2c3d4-0000-0000-0000-000000000001")
VENUE_ID = UUID("d1e2f3a4-0000-0000-0000-000000000001")
EVENT_ID = UUID("b1c2d3e4-0000-0000-0000-000000000001")
SESSION_ID = UUID("c1d2e3f4-0000-0000-0000-000000000001")
ORDER_ID = UUID("e1f2a3b4-0000-0000-0000-000000000001")

SECTION_ID = UUID("f1a2b3c4-0000-0000-0000-000000000001")
PRICE_ZONE_ID = UUID("f1a2b3c4-0001-0000-0000-000000000001")

SEAT_FREE_ID = UUID("a1b2c3d4-0001-0000-0000-000000000001")
TAKEN_SEAT_ID = UUID(
    "a1b2c3d4-0001-0000-0000-000000000003"
)  # зарезервирован — вызывает SEAT_ALREADY_TAKEN

# ─── Primitives ───────────────────────────────────────────────────────────────

CITY = City(id=1, name="Москва", slug="moskva")

CATEGORY = Category(id=1, code=CategoryCode.THEATRE, name="Театр", slug="theatre")

PAGINATION = Pagination(page=1, per_page=20, total=1, total_pages=1)

# ─── Venue ───────────────────────────────────────────────────────────────────

VENUE = Venue(
    id=VENUE_ID,
    name="Большой театр",
    address="Театральная пл., 1",
    city=CITY,
)

# ─── Events ──────────────────────────────────────────────────────────────────

EVENT_BASE = EventBase(
    id=EVENT_ID,
    title="Гамлет",
    description="Трагедия Шекспира в постановке Товстоногова.",
    category=CATEGORY,
    age_rating=AgeRating.SIXTEEN_PLUS,
    poster_url="https://cdn.example.com/hamlet.jpg",
    created_at=datetime(2026, 9, 1, 0, 0, 0, tzinfo=UTC),
    updated_at=datetime(2026, 9, 1, 0, 0, 0, tzinfo=UTC),
)

EVENT_SUMMARY = EventSummary(
    id=EVENT_ID,
    title="Гамлет",
    description="Трагедия Шекспира в постановке Товстоногова.",
    category=CATEGORY,
    age_rating=AgeRating.SIXTEEN_PLUS,
    poster_url="https://cdn.example.com/hamlet.jpg",
    created_at=datetime(2026, 9, 1, 0, 0, 0, tzinfo=UTC),
    updated_at=datetime(2026, 9, 10, 12, 0, 0, tzinfo=UTC),
    nearest_session_at=datetime(2026, 10, 15, 19, 0, 0, tzinfo=UTC),
    min_price=Decimal("2000.00"),
    sessions_count=5,
)

EVENT_DETAIL = EventDetail(
    id=EVENT_ID,
    title="Гамлет",
    description="Трагедия Шекспира в постановке Товстоногова.",
    category=CATEGORY,
    age_rating=AgeRating.SIXTEEN_PLUS,
    poster_url="https://cdn.example.com/hamlet.jpg",
    created_at=datetime(2026, 9, 1, 0, 0, 0, tzinfo=UTC),
    updated_at=datetime(2026, 9, 10, 12, 0, 0, tzinfo=UTC),
    nearest_session_at=datetime(2026, 10, 15, 19, 0, 0, tzinfo=UTC),
    min_price=Decimal("2000.00"),
    sessions_count=5,
)

# ─── Session ─────────────────────────────────────────────────────────────────

SESSION = Session(
    id=SESSION_ID,
    event_id=EVENT_ID,
    venue=VENUE,
    city=CITY,
    starts_at=datetime(2026, 10, 15, 19, 0, 0, tzinfo=UTC),
    price=Decimal("2000.00"),
    total_seats=300,
    seats_left=142,
    status=SessionStatus.ACTIVE,
)

# ─── Auth ────────────────────────────────────────────────────────────────────

USER = UserProfile(
    id=USER_ID,
    email="user@example.com",
    role=UserRole.VISITOR,
    created_at=datetime(2026, 9, 11, 10, 0, 0, tzinfo=UTC),
)

AUTH_RESPONSE = AuthResponse(
    data=AuthResponseData(
        token="eyJhbGciOiJIUzI1NiJ9...",
        expires_in=604800,
        user=USER,
    )
)

# ─── Orders ──────────────────────────────────────────────────────────────────

ORDER = OrderDetail(
    id=ORDER_ID,
    session=OrderSessionRef(
        id=SESSION_ID,
        event=OrderEventRef(
            id=EVENT_ID,
            title="Гамлет",
            poster_url="https://cdn.example.com/hamlet.jpg",
        ),
        venue=OrderVenueRef(
            name="Большой театр",
            address="Театральная пл., 1",
            city=CITY,
        ),
        starts_at=datetime(2026, 10, 15, 19, 0, 0, tzinfo=UTC),
        price=Decimal("2000.00"),
    ),
    seats=[
        BookedSeat(
            id=SEAT_FREE_ID,
            section=BookedSection(id=SECTION_ID, name="Партер", kind="seated"),
            row_label="1",
            seat_label="1",
            price_zone=BookedZone(id=PRICE_ZONE_ID, name="Партер"),
            price=Decimal("2000.00"),
        ),
        BookedSeat(
            id=TAKEN_SEAT_ID,
            section=BookedSection(id=SECTION_ID, name="Партер", kind="seated"),
            row_label="1",
            seat_label="3",
            price_zone=BookedZone(id=PRICE_ZONE_ID, name="Партер"),
            price=Decimal("2000.00"),
        ),
    ],
    total_price=Decimal("4000.00"),
    status=OrderStatus.PENDING,
    expires_at=datetime(2026, 10, 1, 10, 15, 0, tzinfo=UTC),
    created_at=datetime(2026, 10, 1, 10, 0, 0, tzinfo=UTC),
    updated_at=datetime(2026, 10, 1, 10, 0, 0, tzinfo=UTC),
)
