from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.enums import PriceCategory, SessionStatus
from app.models.categories import Category
from app.models.cities import City
from app.models.seats import Seat
from app.models.sessions import Session as SessionModel
from tests.factories import (
    make_event,
    make_session,
    make_user,
    make_venue,
)

URL = "/api/v1/orders"


async def _make_seats(s: AsyncSession, venue) -> list[Seat]:
    seats = []
    for row in range(1, venue.rows_count + 1):
        for seat_no in range(1, venue.seats_per_row + 1):
            seat = Seat(
                venue_id=venue.id,
                row_no=row,
                seat_no=seat_no,
                price_category=PriceCategory.STALLS,
                price_factor=Decimal("1.00"),
            )
            s.add(seat)
            seats.append(seat)
    await s.flush()
    return seats


@pytest_asyncio.fixture
async def ctx(session: AsyncSession):
    city = (await session.execute(select(City).where(City.slug == "moscow"))).scalar_one()
    category = (
        await session.execute(select(Category).where(Category.slug == "concert"))
    ).scalar_one()
    venue = await make_venue(session, city, rows_count=2, seats_per_row=3)
    event = await make_event(session, category)
    db_session = await make_session(session, event, venue, city)
    user = await make_user(session)
    seats = await _make_seats(session, venue)
    token, _ = create_access_token(user.id)
    return SimpleNamespace(
        session_id=str(db_session.id),
        db_session=db_session,
        city=city,
        seats=seats,
        token=token,
    )


@pytest.mark.asyncio
async def test_create_order_201(client: AsyncClient, ctx):
    """201, статус pending, expires_at ≈ +15мин, места и сумма в теле."""
    seat_ids = [str(ctx.seats[0].id), str(ctx.seats[1].id)]
    r = await client.post(
        URL,
        json={"session_id": ctx.session_id, "seat_ids": seat_ids},
        headers={"Authorization": f"Bearer {ctx.token}"},
    )
    assert r.status_code == 201
    data = r.json()["data"]
    assert data["status"] == "pending"
    assert len(data["seats"]) == 2
    assert data["total_price"] == "1000.00"  # 500 * 1.00 * 2

    expires_at = datetime.fromisoformat(data["expires_at"])
    diff = expires_at - datetime.now(UTC)
    assert 14 * 60 < diff.total_seconds() < 16 * 60


@pytest.mark.asyncio
async def test_seats_available_decremented(client: AsyncClient, ctx, session: AsyncSession):
    """seats_available уменьшился ровно на число мест в заказе."""
    initial = ctx.db_session.seats_available
    seat_ids = [str(ctx.seats[0].id), str(ctx.seats[1].id)]

    r = await client.post(
        URL,
        json={"session_id": ctx.session_id, "seat_ids": seat_ids},
        headers={"Authorization": f"Bearer {ctx.token}"},
    )
    assert r.status_code == 201

    await session.refresh(ctx.db_session)
    assert ctx.db_session.seats_available == initial - 2


@pytest.mark.asyncio
async def test_seat_already_taken_409(client: AsyncClient, ctx):
    """Повторная бронь того же места → 409 SEAT_ALREADY_TAKEN с details."""
    seat_id = str(ctx.seats[0].id)  # до запросов, пока ORM-объект жив
    seat_ids = [seat_id]
    headers = {"Authorization": f"Bearer {ctx.token}"}

    r1 = await client.post(
        URL, json={"session_id": ctx.session_id, "seat_ids": seat_ids}, headers=headers
    )
    assert r1.status_code == 201

    r2 = await client.post(
        URL, json={"session_id": ctx.session_id, "seat_ids": seat_ids}, headers=headers
    )
    assert r2.status_code == 409
    body = r2.json()
    assert body["code"] == "SEAT_ALREADY_TAKEN"
    assert any(d["seat_id"] == seat_id for d in body["details"])


@pytest.mark.asyncio
async def test_failed_booking_no_leftovers(client: AsyncClient, ctx, session: AsyncSession):
    """После неудачной попытки нет ни заказа ни броней, seats_available не изменился."""
    from sqlalchemy import func

    from app.models.bookings import Booking
    from app.models.orders import Order

    seat_ids = [str(ctx.seats[0].id)]
    headers = {"Authorization": f"Bearer {ctx.token}"}

    # Первая бронь успешна
    await client.post(
        URL, json={"session_id": ctx.session_id, "seat_ids": seat_ids}, headers=headers
    )
    await session.refresh(ctx.db_session)
    available_after_first = ctx.db_session.seats_available

    orders_before = (
        await session.execute(select(func.count()).select_from(Order))
    ).scalar_one()
    bookings_before = (
        await session.execute(select(func.count()).select_from(Booking))
    ).scalar_one()

    # Вторая бронь того же места — должна упасть
    r = await client.post(
        URL, json={"session_id": ctx.session_id, "seat_ids": seat_ids}, headers=headers
    )
    assert r.status_code == 409

    await session.refresh(ctx.db_session)
    orders_after = (
        await session.execute(select(func.count()).select_from(Order))
    ).scalar_one()
    bookings_after = (
        await session.execute(select(func.count()).select_from(Booking))
    ).scalar_one()

    assert orders_after == orders_before
    assert bookings_after == bookings_before
    assert ctx.db_session.seats_available == available_after_first


@pytest.mark.asyncio
async def test_wrong_venue_seat_422(client: AsyncClient, ctx, session: AsyncSession):
    """Место из другого зала → 422 VALIDATION_ERROR."""
    venue2 = await make_venue(session, ctx.city, name="Другой зал")
    other_seat = Seat(
        venue_id=venue2.id,
        row_no=1,
        seat_no=1,
        price_category=PriceCategory.STALLS,
        price_factor=Decimal("1.00"),
    )
    session.add(other_seat)
    await session.flush()

    r = await client.post(
        URL,
        json={"session_id": ctx.session_id, "seat_ids": [str(other_seat.id)]},
        headers={"Authorization": f"Bearer {ctx.token}"},
    )
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_cancelled_session_409(client: AsyncClient, ctx, session: AsyncSession):
    """Отменённый сеанс → 409 SESSION_NOT_ACTIVE."""
    await session.execute(
        update(SessionModel)
        .where(SessionModel.id == ctx.db_session.id)
        .values(status=SessionStatus.CANCELLED)
    )
    await session.flush()

    r = await client.post(
        URL,
        json={"session_id": ctx.session_id, "seat_ids": [str(ctx.seats[0].id)]},
        headers={"Authorization": f"Bearer {ctx.token}"},
    )
    assert r.status_code == 409
    assert r.json()["code"] == "SESSION_NOT_ACTIVE"


@pytest.mark.asyncio
async def test_past_session_409(client: AsyncClient, ctx, session: AsyncSession):
    """Прошедший сеанс → 409 SESSION_NOT_ACTIVE."""
    await session.execute(
        update(SessionModel)
        .where(SessionModel.id == ctx.db_session.id)
        .values(starts_at=datetime.now(UTC) - timedelta(hours=1))
    )
    await session.flush()

    r = await client.post(
        URL,
        json={"session_id": ctx.session_id, "seat_ids": [str(ctx.seats[0].id)]},
        headers={"Authorization": f"Bearer {ctx.token}"},
    )
    assert r.status_code == 409
    assert r.json()["code"] == "SESSION_NOT_ACTIVE"


@pytest.mark.asyncio
async def test_no_token_401(client: AsyncClient, ctx):
    """Без токена → 401 UNAUTHORIZED."""
    r = await client.post(
        URL,
        json={"session_id": ctx.session_id, "seat_ids": [str(ctx.seats[0].id)]},
    )
    assert r.status_code == 401
    assert r.json()["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_too_many_seats_422(client: AsyncClient, ctx):
    """Больше 10 мест → 422 VALIDATION_ERROR."""
    import uuid

    seat_ids = [str(uuid.uuid4()) for _ in range(11)]
    r = await client.post(
        URL,
        json={"session_id": ctx.session_id, "seat_ids": seat_ids},
        headers={"Authorization": f"Bearer {ctx.token}"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_empty_seats_422(client: AsyncClient, ctx):
    """Пустой список мест → 422 VALIDATION_ERROR."""
    r = await client.post(
        URL,
        json={"session_id": ctx.session_id, "seat_ids": []},
        headers={"Authorization": f"Bearer {ctx.token}"},
    )
    assert r.status_code == 422
