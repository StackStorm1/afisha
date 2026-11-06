import copy
import uuid
from decimal import Decimal
from types import SimpleNamespace

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.enums import UserRole
from app.models.categories import Category
from app.models.cities import City
from app.models.hall_layouts import HallLayout
from app.models.sessions import Session as SessionModel
from tests.factories import (
    layout_draft,
    make_event,
    make_layout,
    make_session,
    make_user,
    make_venue,
    seated_seats,
    zones_of,
)

API = "/api/v1/admin"


def _auth(user) -> dict[str, str]:
    token, _ = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def ctx(session: AsyncSession):
    city = (
        await session.execute(select(City).where(City.slug == "moscow"))
    ).scalar_one()
    category = (
        await session.execute(select(Category).where(Category.slug == "concert"))
    ).scalar_one()
    venue = await make_venue(session, city)
    admin = await make_user(session, email="admin@example.com", role=UserRole.ADMIN)
    visitor = await make_user(session, email="visitor@example.com")
    return SimpleNamespace(
        session=session,
        city=city,
        category=category,
        venue=venue,
        admin=_auth(admin),
        visitor=_auth(visitor),
        visitor_user=visitor,
    )


async def _session_on(ctx, layout, **kwargs) -> SessionModel:
    event = await make_event(ctx.session, ctx.category)
    return await make_session(
        ctx.session, event, ctx.venue, ctx.city, layout=layout, **kwargs
    )


# ─── Конфигурации ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_venue_layouts(client: AsyncClient, ctx):
    """По position, без архивных, со счётчиком сеансов."""
    second = await make_layout(ctx.session, ctx.venue, position=1)
    first = await make_layout(ctx.session, ctx.venue, position=0)
    await make_layout(ctx.session, ctx.venue, position=2, is_archived=True)
    await _session_on(ctx, second)

    r = await client.get(f"{API}/venues/{ctx.venue.id}/layouts", headers=ctx.admin)
    assert r.status_code == 200
    data = r.json()["data"]
    assert [d["id"] for d in data] == [str(first.id), str(second.id)]
    assert [d["sessions_count"] for d in data] == [0, 1]


@pytest.mark.asyncio
async def test_layouts_require_admin(client: AsyncClient, ctx):
    url = f"{API}/venues/{ctx.venue.id}/layouts"
    assert (await client.get(url)).status_code == 401
    r = await client.get(url, headers=ctx.visitor)
    assert r.status_code == 403
    assert r.json()["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_unknown_venue_404(client: AsyncClient, ctx):
    r = await client.get(f"{API}/venues/{uuid.uuid4()}/layouts", headers=ctx.admin)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_create_layout(client: AsyncClient, ctx):
    """Места строит сервер, ссылки на зоны перешиты на выданные id."""
    r = await client.post(
        f"{API}/venues/{ctx.venue.id}/layouts",
        json=layout_draft(rows=3, seats_per_row=4, standing_capacity=50),
        headers=ctx.admin,
    )
    assert r.status_code == 201
    data = r.json()["data"]
    zones = {z["name"]: z["id"] for z in data["price_zones"]}
    seated, standing = data["sections"]

    assert len(seated["seats"]) == 12
    assert seated["seats"][0]["row_label"] == "1"
    assert {s["price_zone_id"] for s in seated["seats"][:4]} == {zones["Партер"]}
    assert [r["price_zone_id"] for r in seated["generator"]["zone_ranges"]] == [
        zones["Партер"],
        zones["Балкон"],
    ]
    assert standing["kind"] == "standing"
    assert standing["capacity"] == 50
    assert standing["price_zone_id"] == zones["Балкон"]
    assert standing["seats"] is None


@pytest.mark.asyncio
async def test_create_layout_with_issues_422(client: AsyncClient, ctx):
    draft = layout_draft()
    draft["sections"][1]["shape"] = draft["sections"][0]["shape"]
    r = await client.post(
        f"{API}/venues/{ctx.venue.id}/layouts", json=draft, headers=ctx.admin
    )
    assert r.status_code == 422
    assert r.json()["details"] == [
        {"field": "sections", "message": "«Танцпол» пересекается с сектором «Партер»"}
    ]


@pytest.mark.asyncio
async def test_get_layout_404(client: AsyncClient, ctx):
    r = await client.get(f"{API}/layouts/{uuid.uuid4()}", headers=ctx.admin)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_revision_without_sessions_updates_in_place(client: AsyncClient, ctx):
    layout = await make_layout(ctx.session, ctx.venue)
    draft = layout_draft(rows=5, standing_capacity=None, name="Камерная")

    r = await client.post(
        f"{API}/layouts/{layout.id}/revisions", json=draft, headers=ctx.admin
    )
    assert r.status_code == 200
    body = r.json()
    assert body["revision"] == "updated"
    assert body["data"]["id"] == str(layout.id)
    assert body["data"]["name"] == "Камерная"
    assert [s["name"] for s in body["data"]["sections"]] == ["Партер"]
    assert len(body["data"]["sections"][0]["seats"]) == 15


@pytest.mark.asyncio
async def test_revision_with_sessions_creates_new(client: AsyncClient, ctx):
    """Старая уходит в архив и остаётся у сеанса, новая встаёт на её место."""
    layout = await make_layout(ctx.session, ctx.venue, position=0)
    other = await make_layout(ctx.session, ctx.venue, position=1)
    db_session = await _session_on(ctx, layout)

    r = await client.post(
        f"{API}/layouts/{layout.id}/revisions",
        json=layout_draft(rows=4),
        headers=ctx.admin,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["revision"] == "created"
    new_id = body["data"]["id"]
    assert new_id != str(layout.id)

    await ctx.session.refresh(layout)
    await ctx.session.refresh(db_session)
    assert layout.is_archived
    assert db_session.layout_id == layout.id

    listed = await client.get(f"{API}/venues/{ctx.venue.id}/layouts", headers=ctx.admin)
    assert [d["id"] for d in listed.json()["data"]] == [new_id, str(other.id)]

    again = await client.post(
        f"{API}/layouts/{layout.id}/revisions",
        json=layout_draft(),
        headers=ctx.admin,
    )
    assert again.status_code == 409
    assert again.json()["code"] == "LAYOUT_ARCHIVED"


# ─── Схема зала сеанса ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_session_hall(client: AsyncClient, ctx):
    layout = await make_layout(ctx.session, ctx.venue)
    db_session = await _session_on(
        ctx, layout, zone_prices=[Decimal("900.00"), Decimal("400.00")]
    )
    zones = await zones_of(ctx.session, layout)

    r = await client.get(f"{API}/sessions/{db_session.id}/hall", headers=ctx.admin)
    assert r.status_code == 200
    assert r.json()["data"] == {
        "session_id": str(db_session.id),
        "layout_id": str(layout.id),
        "prices": [
            {"price_zone_id": str(zones[0].id), "price": "900.00"},
            {"price_zone_id": str(zones[1].id), "price": "400.00"},
        ],
        "sold_count": 0,
    }


@pytest.mark.asyncio
async def test_switch_session_layout(client: AsyncClient, ctx):
    """Смена конфигурации пересчитывает вместимость и цену «от»."""
    layout = await make_layout(ctx.session, ctx.venue)
    club = await make_layout(
        ctx.session,
        ctx.venue,
        draft=layout_draft(rows=4, seats_per_row=5, standing_capacity=20),
        position=1,
    )
    db_session = await _session_on(ctx, layout)
    zones = await zones_of(ctx.session, club)

    r = await client.put(
        f"{API}/sessions/{db_session.id}/hall",
        json={
            "layout_id": str(club.id),
            "prices": [
                {"price_zone_id": str(zones[0].id), "price": "1500.00"},
                {"price_zone_id": str(zones[1].id), "price": "700.00"},
            ],
        },
        headers=ctx.admin,
    )
    assert r.status_code == 200
    assert r.json()["data"]["layout_id"] == str(club.id)

    await ctx.session.refresh(db_session)
    assert db_session.layout_id == club.id
    assert db_session.seats_total == db_session.seats_available == 20 + 20
    assert db_session.base_price == Decimal("700.00")


@pytest.mark.asyncio
async def test_session_hall_blocked_by_bookings(client: AsyncClient, ctx):
    layout = await make_layout(ctx.session, ctx.venue)
    db_session = await _session_on(ctx, layout)
    seat = (await seated_seats(ctx.session, layout))[0]
    booked = await client.post(
        "/api/v1/orders",
        json={"session_id": str(db_session.id), "seat_ids": [str(seat.id)]},
        headers=ctx.visitor,
    )
    assert booked.status_code == 201
    zones = await zones_of(ctx.session, layout)

    r = await client.put(
        f"{API}/sessions/{db_session.id}/hall",
        json={
            "layout_id": str(layout.id),
            "prices": [{"price_zone_id": str(z.id), "price": "1.00"} for z in zones],
        },
        headers=ctx.admin,
    )
    assert r.status_code == 409
    assert r.json()["code"] == "SESSION_HAS_BOOKINGS"

    hall = await client.get(f"{API}/sessions/{db_session.id}/hall", headers=ctx.admin)
    assert hall.json()["data"]["sold_count"] == 1


@pytest.mark.asyncio
async def test_session_hall_validation(client: AsyncClient, ctx):
    layout = await make_layout(ctx.session, ctx.venue)
    archived = await make_layout(ctx.session, ctx.venue, position=1, is_archived=True)
    foreign_venue = await make_venue(ctx.session, ctx.city, name="Другой зал")
    foreign = await make_layout(ctx.session, foreign_venue)
    db_session = await _session_on(ctx, layout)
    zones = await zones_of(ctx.session, layout)
    url = f"{API}/sessions/{db_session.id}/hall"

    async def put(layout_id, prices):
        return await client.put(
            url,
            json={"layout_id": str(layout_id), "prices": prices},
            headers=ctx.admin,
        )

    r = await put(foreign.id, [])
    assert r.status_code == 422
    assert r.json()["details"][0]["field"] == "layout_id"

    r = await put(archived.id, [])
    assert r.status_code == 422
    assert r.json()["details"][0]["message"] == "Конфигурация в архиве"

    r = await put(layout.id, [{"price_zone_id": str(zones[0].id), "price": "10.00"}])
    assert r.status_code == 422
    assert r.json()["details"] == [
        {
            "field": f"prices.{zones[1].id}",
            "message": "Укажите цену для зоны «Балкон»",
        }
    ]


@pytest.mark.asyncio
async def test_layout_draft_is_not_mutated(ctx):
    """materialize не трогает переданный черновик: фабрики переиспользуют его."""
    draft = layout_draft()
    before = copy.deepcopy(draft)
    await make_layout(ctx.session, ctx.venue, draft=draft)
    assert draft == before
    assert (
        await ctx.session.execute(
            select(HallLayout).where(HallLayout.venue_id == ctx.venue.id)
        )
    ).scalar_one()
