import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.db.session import get_engine, get_session_maker
from app.enums import BookingStatus, SessionStatus
from app.models.bookings import Booking
from app.models.categories import Category
from app.models.cities import City
from app.models.events import Event
from app.models.hall_layouts import HallLayout
from app.models.orders import Order
from app.models.session_zone_prices import SessionZonePrice
from app.models.sessions import Session as SessionModel
from app.models.users import User
from app.models.venues import Venue
from app.schemas.orders import StandingRequest
from app.services.orders import create_order
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

# Зона «Партер» (первый ряд) и «Балкон» (второй ряд и танцпол).
PRICES = [Decimal("500.00"), Decimal("300.00")]


@pytest_asyncio.fixture
async def ctx(session: AsyncSession):
    city = (
        await session.execute(select(City).where(City.slug == "moscow"))
    ).scalar_one()
    category = (
        await session.execute(select(Category).where(Category.slug == "concert"))
    ).scalar_one()
    venue = await make_venue(session, city)
    layout = await make_layout(session, venue)
    event = await make_event(session, category)
    db_session = await make_session(
        session, event, venue, city, layout=layout, zone_prices=PRICES
    )
    user = await make_user(session)
    seats = await seated_seats(session, layout)
    floor = await section_by_name(session, layout, "Танцпол")
    parterre = await section_by_name(session, layout, "Партер")
    token, _ = create_access_token(user.id)
    return SimpleNamespace(
        session_id=str(db_session.id),
        db_session=db_session,
        city=city,
        venue=venue,
        seat_ids=[str(seat.id) for seat in seats],
        floor_id=str(floor.id),
        parterre_id=str(parterre.id),
        headers={"Authorization": f"Bearer {token}"},
    )


async def _post(client: AsyncClient, ctx, **body):
    return await client.post(
        URL, json={"session_id": ctx.session_id, **body}, headers=ctx.headers
    )


@pytest.mark.asyncio
async def test_create_order_201(client: AsyncClient, ctx):
    """201, статус pending, expires_at ≈ +15мин, цены по зонам."""
    r = await _post(client, ctx, seat_ids=[ctx.seat_ids[0], ctx.seat_ids[3]])
    assert r.status_code == 201
    data = r.json()["data"]
    assert data["status"] == "pending"
    assert data["total_price"] == "800.00"  # партер 500 + балкон 300
    first, second = data["seats"]
    assert first["section"] == {
        "id": ctx.parterre_id,
        "name": "Партер",
        "kind": "seated",
    }
    assert (first["row_label"], first["seat_label"]) == ("1", "1")
    assert first["price_zone"]["name"] == "Партер"
    assert first["price"] == "500.00"
    assert (second["row_label"], second["price_zone"]["name"]) == ("2", "Балкон")

    expires_at = datetime.fromisoformat(data["expires_at"])
    diff = expires_at - datetime.now(UTC)
    assert 14 * 60 < diff.total_seconds() < 16 * 60


@pytest.mark.asyncio
async def test_standing_tickets(client: AsyncClient, ctx, session: AsyncSession):
    """Танцпол покупается количеством: единицы без ряда и места."""
    r = await _post(
        client,
        ctx,
        seat_ids=[ctx.seat_ids[0]],
        standing=[{"section_id": ctx.floor_id, "quantity": 2}],
    )
    assert r.status_code == 201
    data = r.json()["data"]
    assert data["total_price"] == "1100.00"  # 500 + 2 × 300
    standing = [s for s in data["seats"] if s["section"]["kind"] == "standing"]
    assert len(standing) == 2
    assert all(s["row_label"] is None and s["seat_label"] is None for s in standing)
    assert len({s["id"] for s in standing}) == 2

    await session.refresh(ctx.db_session)
    assert ctx.db_session.seats_available == ctx.db_session.seats_total - 3


@pytest.mark.asyncio
async def test_standing_sold_out(client: AsyncClient, ctx):
    """Больше, чем осталось в зоне → 409 NOT_ENOUGH_CAPACITY с остатком."""
    standing = [{"section_id": ctx.floor_id, "quantity": 4}]
    assert (await _post(client, ctx, standing=standing)).status_code == 201

    r = await _post(client, ctx, standing=standing)
    assert r.status_code == 409
    body = r.json()
    assert body["code"] == "NOT_ENOUGH_CAPACITY"
    assert body["details"][0]["section_id"] == ctx.floor_id
    assert body["details"][0]["available"] == 1


@pytest.mark.asyncio
async def test_seated_section_as_standing_422(client: AsyncClient, ctx):
    r = await _post(
        client, ctx, standing=[{"section_id": ctx.parterre_id, "quantity": 1}]
    )
    assert r.status_code == 422
    assert r.json()["code"] == "SECTION_NOT_STANDING"


@pytest.mark.asyncio
async def test_seats_available_decremented(
    client: AsyncClient, ctx, session: AsyncSession
):
    """seats_available уменьшился ровно на число мест в заказе."""
    initial = ctx.db_session.seats_available
    r = await _post(client, ctx, seat_ids=ctx.seat_ids[:2])
    assert r.status_code == 201

    await session.refresh(ctx.db_session)
    assert ctx.db_session.seats_available == initial - 2


@pytest.mark.asyncio
async def test_seat_already_taken_409(client: AsyncClient, ctx):
    """Повторная бронь того же места → 409 SEAT_ALREADY_TAKEN с подписью места."""
    seat_id = ctx.seat_ids[0]
    assert (await _post(client, ctx, seat_ids=[seat_id])).status_code == 201

    r = await _post(client, ctx, seat_ids=[seat_id])
    assert r.status_code == 409
    body = r.json()
    assert body["code"] == "SEAT_ALREADY_TAKEN"
    assert body["details"] == [
        {"seat_id": seat_id, "message": "Партер, ряд 1, место 1 уже занято"}
    ]


@pytest.mark.asyncio
async def test_failed_booking_no_leftovers(
    client: AsyncClient, ctx, session: AsyncSession
):
    """После неудачной попытки нет ни заказа ни броней, seats_available не изменился."""
    seat_ids = [ctx.seat_ids[0]]
    await _post(client, ctx, seat_ids=seat_ids)
    await session.refresh(ctx.db_session)
    available_after_first = ctx.db_session.seats_available

    async def count(model):
        return (
            await session.execute(select(func.count()).select_from(model))
        ).scalar_one()

    orders_before, bookings_before = await count(Order), await count(Booking)

    r = await _post(client, ctx, seat_ids=seat_ids)
    assert r.status_code == 409

    await session.refresh(ctx.db_session)
    assert await count(Order) == orders_before
    assert await count(Booking) == bookings_before
    assert ctx.db_session.seats_available == available_after_first


@pytest.mark.asyncio
async def test_seat_of_other_layout_422(
    client: AsyncClient, ctx, session: AsyncSession
):
    """Место другой конфигурации → 422 VALIDATION_ERROR."""
    other = await make_layout(session, ctx.venue, position=1)
    other_seat = (await seated_seats(session, other))[0]

    r = await _post(client, ctx, seat_ids=[str(other_seat.id)])
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

    r = await _post(client, ctx, seat_ids=[ctx.seat_ids[0]])
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

    r = await _post(client, ctx, seat_ids=[ctx.seat_ids[0]])
    assert r.status_code == 409
    assert r.json()["code"] == "SESSION_NOT_ACTIVE"


@pytest.mark.asyncio
async def test_no_token_401(client: AsyncClient, ctx):
    """Без токена → 401 UNAUTHORIZED."""
    r = await client.post(
        URL, json={"session_id": ctx.session_id, "seat_ids": [ctx.seat_ids[0]]}
    )
    assert r.status_code == 401
    assert r.json()["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_too_many_tickets_422(client: AsyncClient, ctx):
    """Больше 10 билетов в сумме мест и стоячих → 422 VALIDATION_ERROR."""
    r = await _post(
        client,
        ctx,
        seat_ids=ctx.seat_ids[:6],
        standing=[{"section_id": ctx.floor_id, "quantity": 5}],
    )
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_empty_order_422(client: AsyncClient, ctx):
    """Ни мест, ни стоячих → 422 VALIDATION_ERROR."""
    r = await _post(client, ctx, seat_ids=[])
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_duplicate_seat_422(client: AsyncClient, ctx):
    """Одно место дважды — ошибка запроса, а не SEAT_ALREADY_TAKEN."""
    r = await _post(client, ctx, seat_ids=[ctx.seat_ids[0], ctx.seat_ids[0]])
    assert r.status_code == 422
    assert r.json()["details"][0]["field"] == "seat_ids"


# ─── Гонка за стоячую зону ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_standing_race_sells_exactly_capacity(migrated_database):
    """Параллельные заказы в зону через отдельные соединения.

    Пять заказов по 2 билета на зону вместимостью 5: продаётся ровно 4
    единицы (два заказа), остальные получают NOT_ENOUGH_CAPACITY. Данные
    коммитятся по-настоящему, поэтому тест сам за собой убирает.
    """
    from fastapi import HTTPException

    maker = get_session_maker()
    async with maker() as s:
        city = (await s.execute(select(City).where(City.slug == "moscow"))).scalar_one()
        category = (
            await s.execute(select(Category).where(Category.slug == "concert"))
        ).scalar_one()
        venue = await make_venue(s, city, name=f"Гонка {uuid.uuid4()}")
        layout = await make_layout(s, venue, draft=layout_draft(standing_capacity=5))
        event = await make_event(s, category)
        db_session = await make_session(s, event, venue, city, layout=layout)
        users = [
            await make_user(s, email=f"race-{i}-{uuid.uuid4()}@example.com")
            for i in range(5)
        ]
        floor = await section_by_name(s, layout, "Танцпол")
        await s.commit()
        ids = SimpleNamespace(
            session=db_session.id,
            floor=floor.id,
            venue=venue.id,
            layout=layout.id,
            event=event.id,
            users=[u.id for u in users],
        )

    async def attempt(user_id):
        async with maker() as s:
            user = await s.get(User, user_id)
            try:
                await create_order(
                    s,
                    ids.session,
                    [],
                    [StandingRequest(section_id=ids.floor, quantity=2)],
                    user,
                )
                return "ok"
            except HTTPException as exc:
                return exc.detail["code"]

    try:
        results = await asyncio.gather(*(attempt(u) for u in ids.users))
        assert results.count("ok") == 2
        assert set(results) - {"ok"} == {"NOT_ENOUGH_CAPACITY"}

        async with maker() as s:
            held = (
                await s.execute(
                    select(func.count()).where(
                        Booking.session_id == ids.session,
                        Booking.status == BookingStatus.HELD,
                    )
                )
            ).scalar_one()
            available = (
                await s.execute(
                    select(SessionModel.seats_available).where(
                        SessionModel.id == ids.session
                    )
                )
            ).scalar_one()
        assert held == 4
        total = 6 + 5  # 2 ряда по 3 места + танцпол
        assert available == total - 4
    finally:
        async with maker() as s:
            await s.execute(delete(Booking).where(Booking.session_id == ids.session))
            await s.execute(delete(Order).where(Order.session_id == ids.session))
            await s.execute(
                delete(SessionZonePrice).where(
                    SessionZonePrice.session_id == ids.session
                )
            )
            await s.execute(delete(SessionModel).where(SessionModel.id == ids.session))
            await s.execute(delete(HallLayout).where(HallLayout.id == ids.layout))
            await s.execute(delete(Venue).where(Venue.id == ids.venue))
            await s.execute(delete(Event).where(Event.id == ids.event))
            await s.execute(delete(User).where(User.id.in_(ids.users)))
            await s.commit()
        await get_engine().dispose()
