from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.enums import BookingStatus, OrderStatus
from app.models.bookings import Booking
from app.models.categories import Category
from app.models.cities import City
from app.models.orders import Order
from app.services.booking_expiry import expire_bookings
from tests.factories import (
    layout_draft,
    make_event,
    make_layout,
    make_session,
    make_user,
    make_venue,
    seated_seats,
    section_by_name,
)

URL = "/api/v1/orders"


@pytest_asyncio.fixture
async def ctx(session: AsyncSession):
    city = (
        await session.execute(select(City).where(City.slug == "moscow"))
    ).scalar_one()
    category = (
        await session.execute(select(Category).where(Category.slug == "concert"))
    ).scalar_one()
    venue = await make_venue(session, city)
    layout = await make_layout(
        session, venue, draft=layout_draft(rows=1, seats_per_row=4, standing_capacity=3)
    )
    event = await make_event(session, category)
    db_session = await make_session(session, event, venue, city, layout=layout)
    user = await make_user(session)
    token, _ = create_access_token(user.id)
    return SimpleNamespace(
        db_session=db_session,
        session_id=str(db_session.id),
        seat_ids=[str(seat.id) for seat in await seated_seats(session, layout)],
        floor_id=str((await section_by_name(session, layout, "Танцпол")).id),
        headers={"Authorization": f"Bearer {token}"},
    )


async def _book(
    client: AsyncClient, ctx, seat_ids: list[str], standing: int = 0
) -> UUID:
    body = {"session_id": ctx.session_id, "seat_ids": seat_ids}
    if standing:
        body["standing"] = [{"section_id": ctx.floor_id, "quantity": standing}]
    r = await client.post(URL, json=body, headers=ctx.headers)
    assert r.status_code == 201
    return UUID(r.json()["data"]["id"])


async def _age(session: AsyncSession, order_id: UUID) -> None:
    """Сдвигает срок удержания заказа в прошлое."""
    await session.execute(
        update(Booking)
        .where(Booking.order_id == order_id)
        .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    )
    await session.flush()


async def _bookings(session: AsyncSession, order_id: UUID) -> list[Booking]:
    result = await session.execute(
        select(Booking)
        .where(Booking.order_id == order_id)
        .execution_options(populate_existing=True)
    )
    return list(result.scalars())


@pytest.mark.asyncio
async def test_expired_hold_released(client: AsyncClient, ctx, session: AsyncSession):
    """Протухшая бронь → EXPIRED, заказ → CANCELLED, места вернулись в продажу."""
    initial = ctx.db_session.seats_available
    order_id = await _book(client, ctx, ctx.seat_ids[:2])
    await _age(session, order_id)

    assert await expire_bookings(session) == 2

    bookings = await _bookings(session, order_id)
    assert {b.status for b in bookings} == {BookingStatus.EXPIRED}
    assert all(b.expires_at is None for b in bookings)
    order = await session.get(Order, order_id, populate_existing=True)
    assert order.status == OrderStatus.CANCELLED
    await session.refresh(ctx.db_session)
    assert ctx.db_session.seats_available == initial


@pytest.mark.asyncio
async def test_released_seat_can_be_booked_again(
    client: AsyncClient, ctx, session: AsyncSession
):
    """После истечения то же место снова бронируется (BR-01 не мешает)."""
    order_id = await _book(client, ctx, ctx.seat_ids[:1])
    await _age(session, order_id)
    await expire_bookings(session)

    await _book(client, ctx, ctx.seat_ids[:1])


@pytest.mark.asyncio
async def test_active_hold_untouched(client: AsyncClient, ctx, session: AsyncSession):
    """Бронь, у которой срок не вышел, задача не трогает."""
    expired_id = await _book(client, ctx, ctx.seat_ids[:1])
    active_id = await _book(client, ctx, ctx.seat_ids[1:3])
    await _age(session, expired_id)

    assert await expire_bookings(session) == 1

    assert {b.status for b in await _bookings(session, active_id)} == {
        BookingStatus.HELD
    }
    order = await session.get(Order, active_id, populate_existing=True)
    assert order.status == OrderStatus.PENDING
    await session.refresh(ctx.db_session)
    assert ctx.db_session.seats_available == ctx.db_session.seats_total - 2


@pytest.mark.asyncio
async def test_failed_payment_hold_expires(
    client: AsyncClient, ctx, session: AsyncSession
):
    """Заказ после отказа шлюза (FAILED) держит места до срока и тоже отменяется."""
    order_id = await _book(client, ctx, ctx.seat_ids[:1])
    await session.execute(
        update(Order).where(Order.id == order_id).values(status=OrderStatus.FAILED)
    )
    await _age(session, order_id)

    assert await expire_bookings(session) == 1

    order = await session.get(Order, order_id, populate_existing=True)
    assert order.status == OrderStatus.CANCELLED


@pytest.mark.asyncio
async def test_nothing_to_expire(client: AsyncClient, ctx, session: AsyncSession):
    """Повторный проход ничего не освобождает и счётчик не раздувает."""
    order_id = await _book(client, ctx, ctx.seat_ids[:2])
    await _age(session, order_id)
    await expire_bookings(session)

    assert await expire_bookings(session) == 0
    await session.refresh(ctx.db_session)
    assert ctx.db_session.seats_available == ctx.db_session.seats_total


@pytest.mark.asyncio
async def test_standing_units_released(client: AsyncClient, ctx, session: AsyncSession):
    """Истёкшие единицы танцпола снова продаются."""
    order_id = await _book(client, ctx, [], standing=3)
    await _age(session, order_id)

    assert await expire_bookings(session) == 3

    await _book(client, ctx, [], standing=3)
