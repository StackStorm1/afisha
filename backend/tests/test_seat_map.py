import uuid
from decimal import Decimal
from types import SimpleNamespace

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.categories import Category
from app.models.cities import City
from tests.factories import (
    make_event,
    make_layout,
    make_session,
    make_user,
    make_venue,
    seated_seats,
    section_by_name,
)


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
        session,
        event,
        venue,
        city,
        layout=layout,
        zone_prices=[Decimal("500.00"), Decimal("300.00")],
    )
    me = await make_user(session, email="me@example.com")
    other = await make_user(session, email="other@example.com")
    return SimpleNamespace(
        url=f"/api/v1/sessions/{db_session.id}/seats",
        session_id=str(db_session.id),
        layout=layout,
        seat_ids=[str(s.id) for s in await seated_seats(session, layout)],
        floor_id=str((await section_by_name(session, layout, "Танцпол")).id),
        me={"Authorization": f"Bearer {create_access_token(me.id)[0]}"},
        other={"Authorization": f"Bearer {create_access_token(other.id)[0]}"},
    )


@pytest.mark.asyncio
async def test_seat_map_shape(client: AsyncClient, ctx):
    r = await client.get(ctx.url)
    assert r.status_code == 200
    data = r.json()["data"]

    assert data["session_id"] == ctx.session_id
    assert data["status"] == "active"
    assert data["layout"] == {
        "id": str(ctx.layout.id),
        "name": "Основная",
        "canvas_width": 840,
        "canvas_height": 640,
    }
    stalls, balcony = data["price_zones"]
    assert (stalls["name"], stalls["price"], stalls["available"]) == (
        "Партер",
        "500.00",
        3,
    )
    # Второй ряд (3 места) и танцпол (5 единиц).
    assert (balcony["price"], balcony["available"]) == ("300.00", 8)

    seated, standing = data["sections"]
    assert seated["kind"] == "seated"
    assert len(seated["seats"]) == 6
    seat = seated["seats"][0]
    assert seat["id"] == ctx.seat_ids[0]
    assert (seat["row_label"], seat["seat_label"]) == ("1", "1")
    assert seat["price_zone_id"] == stalls["id"]
    assert seat["status"] == "free"
    assert isinstance(seat["x"], float)

    assert standing == {
        "id": ctx.floor_id,
        "name": "Танцпол",
        "kind": "standing",
        "shape": standing["shape"],
        "price_zone_id": balcony["id"],
        "capacity": 5,
        "available": 5,
        "held_by_me": 0,
    }


@pytest.mark.asyncio
async def test_seat_map_reflects_holds(client: AsyncClient, ctx):
    """Свои брони — held_by_me, чужие — просто held; счётчики зон уменьшились."""
    booked = await client.post(
        "/api/v1/orders",
        json={
            "session_id": ctx.session_id,
            "seat_ids": [ctx.seat_ids[0]],
            "standing": [{"section_id": ctx.floor_id, "quantity": 2}],
        },
        headers=ctx.me,
    )
    assert booked.status_code == 201

    mine = (await client.get(ctx.url, headers=ctx.me)).json()["data"]
    seated, standing = mine["sections"]
    assert seated["seats"][0]["status"] == "held"
    assert seated["seats"][0]["held_by_me"] is True
    assert (standing["available"], standing["held_by_me"]) == (3, 2)
    assert [z["available"] for z in mine["price_zones"]] == [2, 6]

    theirs = (await client.get(ctx.url, headers=ctx.other)).json()["data"]
    seated, standing = theirs["sections"]
    assert seated["seats"][0]["held_by_me"] is False
    assert standing["held_by_me"] == 0

    guest = (await client.get(ctx.url)).json()["data"]
    assert guest["sections"][1]["held_by_me"] == 0


@pytest.mark.asyncio
async def test_seat_map_404(client: AsyncClient):
    r = await client.get(f"/api/v1/sessions/{uuid.uuid4()}/seats")
    assert r.status_code == 404
