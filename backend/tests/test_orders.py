from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import event, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.enums import BookingStatus, OrderStatus, PriceCategory
from app.models.bookings import Booking
from app.models.categories import Category
from app.models.cities import City
from app.models.orders import Order
from app.models.seats import Seat
from app.models.sessions import Session as SessionModel
from tests.factories import make_event, make_session, make_user, make_venue

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


async def _make_order(
    s: AsyncSession,
    session_orm,
    user,
    seats: list[Seat],
    *,
    status: OrderStatus = OrderStatus.PENDING,
    expires_at: datetime | None = None,
) -> Order:
    if expires_at is None and status == OrderStatus.PENDING:
        expires_at = datetime.now(UTC) + timedelta(minutes=15)
    total = sum(
        (session_orm.base_price * seat.price_factor).quantize(Decimal("0.01"))
        for seat in seats
    )
    paid_at = datetime.now(UTC) if status == OrderStatus.PAID else None
    result = await s.execute(
        insert(Order)
        .values(
            user_id=user.id,
            session_id=session_orm.id,
            total_price=total,
            status=status,
            paid_at=paid_at,
        )
        .returning(Order)
    )
    order = result.scalar_one()

    booking_status = (
        BookingStatus.PAID if status == OrderStatus.PAID else BookingStatus.HELD
    )
    for seat in seats:
        price = (session_orm.base_price * seat.price_factor).quantize(Decimal("0.01"))
        b = Booking(
            session_id=session_orm.id,
            seat_id=seat.id,
            user_id=user.id,
            order_id=order.id,
            price=price,
            status=booking_status,
            expires_at=expires_at if booking_status == BookingStatus.HELD else None,
        )
        s.add(b)
    await s.flush()
    return order


@pytest_asyncio.fixture
async def ctx(session: AsyncSession):
    city = (
        await session.execute(select(City).where(City.slug == "moscow"))
    ).scalar_one()
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
        venue=venue,
        seats=seats,
        user=user,
        token=token,
    )


@pytest.mark.asyncio
async def test_list_only_own_orders(client: AsyncClient, ctx, session: AsyncSession):
    """Список отдаёт только заказы владельца токена."""
    other_user = await make_user(session, email="other@example.com")
    await _make_order(session, ctx.db_session, ctx.user, [ctx.seats[0]])
    await _make_order(session, ctx.db_session, other_user, [ctx.seats[1]])

    r = await client.get(URL, headers={"Authorization": f"Bearer {ctx.token}"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) == 1


@pytest.mark.asyncio
async def test_list_newest_first(client: AsyncClient, ctx, session: AsyncSession):
    """Новые заказы сверху (created_at DESC)."""
    from sqlalchemy import text

    o1 = await _make_order(session, ctx.db_session, ctx.user, [ctx.seats[0]])
    # сдвигаем created_at первого заказа назад, чтобы гарантировать порядок
    await session.execute(
        update(Order)
        .where(Order.id == o1.id)
        .values(created_at=text("now() - interval '1 minute'"))
    )
    o2 = await _make_order(session, ctx.db_session, ctx.user, [ctx.seats[1]])

    r = await client.get(URL, headers={"Authorization": f"Bearer {ctx.token}"})
    assert r.status_code == 200
    ids = [item["id"] for item in r.json()["data"]]
    assert ids.index(str(o2.id)) < ids.index(str(o1.id))


@pytest.mark.asyncio
async def test_list_filter_by_status(client: AsyncClient, ctx, session: AsyncSession):
    """Фильтр status=paid возвращает только paid, пустой результат — не ошибка."""
    await _make_order(
        session, ctx.db_session, ctx.user, [ctx.seats[0]], status=OrderStatus.PENDING
    )

    r = await client.get(
        URL,
        params={"status": "paid"},
        headers={"Authorization": f"Bearer {ctx.token}"},
    )
    assert r.status_code == 200
    assert r.json()["data"] == []


@pytest.mark.asyncio
async def test_get_foreign_order_404(client: AsyncClient, ctx, session: AsyncSession):
    """Чужой заказ по прямой ссылке → 404."""
    other_user = await make_user(session, email="other2@example.com")
    order = await _make_order(session, ctx.db_session, other_user, [ctx.seats[0]])

    r = await client.get(
        f"{URL}/{order.id}", headers={"Authorization": f"Bearer {ctx.token}"}
    )
    assert r.status_code == 404
    assert r.json()["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_cancel_paid_order_frees_seats(
    client: AsyncClient, ctx, session: AsyncSession
):
    """Отмена оплаченного заказа освобождает места: seats_available вырос, место free."""
    seats_to_book = [ctx.seats[0], ctx.seats[1]]
    n = len(seats_to_book)

    await session.execute(
        update(SessionModel)
        .where(SessionModel.id == ctx.db_session.id)
        .values(seats_available=SessionModel.seats_available - n)
    )
    order = await _make_order(
        session, ctx.db_session, ctx.user, seats_to_book, status=OrderStatus.PAID
    )
    await session.flush()
    await session.refresh(ctx.db_session)
    available_before = ctx.db_session.seats_available

    r = await client.delete(
        f"{URL}/{order.id}", headers={"Authorization": f"Bearer {ctx.token}"}
    )
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "cancelled"

    await session.refresh(ctx.db_session)
    assert ctx.db_session.seats_available == available_before + n

    bookings = (
        (await session.execute(select(Booking).where(Booking.order_id == order.id)))
        .scalars()
        .all()
    )
    assert all(b.status == BookingStatus.CANCELLED for b in bookings)
    assert all(b.expires_at is None for b in bookings)


@pytest.mark.asyncio
async def test_cancel_after_session_started_409(
    client: AsyncClient, ctx, session: AsyncSession
):
    """Отмена после начала сеанса → 409 SESSION_ALREADY_STARTED."""
    await session.execute(
        update(SessionModel)
        .where(SessionModel.id == ctx.db_session.id)
        .values(starts_at=datetime.now(UTC) - timedelta(hours=1))
    )
    order = await _make_order(session, ctx.db_session, ctx.user, [ctx.seats[0]])
    await session.flush()

    r = await client.delete(
        f"{URL}/{order.id}", headers={"Authorization": f"Bearer {ctx.token}"}
    )
    assert r.status_code == 409
    assert r.json()["code"] == "SESSION_ALREADY_STARTED"


@pytest.mark.asyncio
async def test_list_query_count_independent_of_orders(
    client: AsyncClient, ctx, session: AsyncSession
):
    """Число запросов к БД не зависит от числа заказов (selectinload, не N+1)."""
    from app.db.session import get_engine

    for seat in ctx.seats:
        await _make_order(session, ctx.db_session, ctx.user, [seat])

    query_count = 0

    def count_query(conn, cursor, statement, parameters, context, executemany):
        nonlocal query_count
        query_count += 1

    event.listen(get_engine().sync_engine, "before_cursor_execute", count_query)
    try:
        r = await client.get(URL, headers={"Authorization": f"Bearer {ctx.token}"})
    finally:
        event.remove(get_engine().sync_engine, "before_cursor_execute", count_query)

    assert r.status_code == 200
    assert len(r.json()["data"]) == len(ctx.seats)
    # selectinload даёт фиксированное число запросов независимо от N заказов:
    # count + select orders + selectinload bookings/seats + selectinload session/venue/city + selectinload event
    assert query_count <= 10
