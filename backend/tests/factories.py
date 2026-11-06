from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import AgeRating, CategoryCode, SectionKind, UserRole
from app.models.categories import Category
from app.models.cities import City
from app.models.events import Event
from app.models.hall_layouts import HallLayout
from app.models.price_zones import PriceZone
from app.models.seats import Seat
from app.models.sections import Section
from app.models.session_zone_prices import SessionZonePrice
from app.models.sessions import Session
from app.models.users import User
from app.models.venues import Venue
from app.services.hall_geometry import rect_shape
from app.services.layouts import materialize


async def make_city(
    session: AsyncSession,
    *,
    name: str = "Москва",
    slug: str = "moscow",
) -> City:
    city = City(name=name, slug=slug)
    session.add(city)
    await session.flush()
    return city


async def make_category(
    session: AsyncSession,
    *,
    code: CategoryCode = CategoryCode.CONCERT,
    name: str = "Концерты",
    slug: str = "concerts",
) -> Category:
    category = Category(code=code, name=name, slug=slug)
    session.add(category)
    await session.flush()
    return category


async def make_user(
    session: AsyncSession,
    *,
    email: str = "test@example.com",
    password_hash: str = "hashed",
    role: UserRole = UserRole.VISITOR,
) -> User:
    user = User(email=email, password_hash=password_hash, role=role)
    session.add(user)
    await session.flush()
    return user


async def make_venue(
    session: AsyncSession,
    city: City,
    *,
    name: str = "Большой зал",
    address: str = "ул. Тестовая, 1",
) -> Venue:
    venue = Venue(city_id=city.id, name=name, address=address)
    session.add(venue)
    await session.flush()
    return venue


def layout_draft(
    *,
    rows: int = 2,
    seats_per_row: int = 3,
    standing_capacity: int | None = 5,
    name: str = "Основная",
) -> dict[str, Any]:
    """Черновик в форме API: сидячий «Партер» (первый ряд — зона «Партер»,
    остальные — «Балкон») и, если задана вместимость, стоячий «Танцпол»
    в зоне «Балкон»."""
    sections: list[dict[str, Any]] = [
        {
            "id": "parterre",
            "name": "Партер",
            "kind": "seated",
            "shape": rect_shape(60, 110, 400, 300),
            "sort_order": 1,
            "generator": {
                "rows_count": rows,
                "seats_first": seats_per_row,
                "seats_last": seats_per_row,
                "numbering": "numeric",
                "zone_ranges": [
                    {"from_row": 1, "to_row": 1, "price_zone_id": "stalls"},
                    {"from_row": 2, "to_row": max(rows, 2), "price_zone_id": "balcony"},
                ],
            },
        }
    ]
    if standing_capacity is not None:
        sections.append(
            {
                "id": "floor",
                "name": "Танцпол",
                "kind": "standing",
                "shape": rect_shape(500, 110, 200, 200),
                "sort_order": 2,
                "price_zone_id": "balcony",
                "capacity": standing_capacity,
            }
        )
    return {
        "name": name,
        "description": "",
        "canvas_width": 840,
        "canvas_height": 640,
        "price_zones": [
            {"id": "stalls", "name": "Партер", "sort_order": 1},
            {"id": "balcony", "name": "Балкон", "sort_order": 2},
        ],
        "sections": sections,
    }


async def make_layout(
    session: AsyncSession,
    venue: Venue,
    *,
    draft: dict[str, Any] | None = None,
    position: int = 0,
    is_archived: bool = False,
) -> HallLayout:
    draft = draft or layout_draft()
    layout = HallLayout(
        venue_id=venue.id,
        name=draft["name"],
        description=draft["description"],
        canvas_width=draft["canvas_width"],
        canvas_height=draft["canvas_height"],
        position=position,
        is_archived=is_archived,
    )
    session.add(layout)
    await session.flush()
    rows = materialize(draft, layout.id)
    await session.execute(insert(PriceZone), rows.zones)
    await session.execute(insert(Section), rows.sections)
    await session.execute(insert(Seat), rows.seats)
    await session.flush()
    return layout


async def seated_seats(session: AsyncSession, layout: HallLayout) -> list[Seat]:
    """Места сидячих секторов конфигурации по порядку."""
    return list(
        (
            await session.execute(
                select(Seat)
                .join(Section, Section.id == Seat.section_id)
                .where(
                    Section.layout_id == layout.id,
                    Section.kind == SectionKind.SEATED,
                )
                .order_by(Section.sort_order, Seat.unit_no)
            )
        ).scalars()
    )


async def section_by_name(
    session: AsyncSession, layout: HallLayout, name: str
) -> Section:
    return (
        await session.execute(
            select(Section).where(Section.layout_id == layout.id, Section.name == name)
        )
    ).scalar_one()


async def zones_of(session: AsyncSession, layout: HallLayout) -> list[PriceZone]:
    return list(
        (
            await session.execute(
                select(PriceZone)
                .where(PriceZone.layout_id == layout.id)
                .order_by(PriceZone.sort_order)
            )
        ).scalars()
    )


async def make_event(
    session: AsyncSession,
    category: Category,
    *,
    title: str = "Тестовое событие",
    age_rating: AgeRating = AgeRating.ZERO_PLUS,
    description: str | None = None,
    poster_url: str | None = None,
) -> Event:
    event = Event(
        title=title,
        category_id=category.id,
        age_rating=age_rating,
        description=description,
        poster_url=poster_url,
    )
    session.add(event)
    await session.flush()
    return event


async def make_session(
    session: AsyncSession,
    event: Event,
    venue: Venue,
    city: City,
    *,
    layout: HallLayout | None = None,
    starts_at: datetime | None = None,
    base_price: Decimal = Decimal("500.00"),
    zone_prices: list[Decimal] | None = None,
) -> Session:
    """Сеанс на конфигурации (по умолчанию — новой из layout_draft).

    zone_prices — цены зон по sort_order; без них каждая зона стоит base_price.
    """
    if layout is None:
        layout = await make_layout(session, venue)
    if starts_at is None:
        starts_at = datetime.now(UTC) + timedelta(days=7)
    zones = await zones_of(session, layout)
    prices = zone_prices or [base_price] * len(zones)
    capacity = (
        await session.execute(
            select(func.count())
            .select_from(Seat)
            .join(Section, Section.id == Seat.section_id)
            .where(Section.layout_id == layout.id)
        )
    ).scalar_one()
    db_session = Session(
        event_id=event.id,
        venue_id=venue.id,
        city_id=city.id,
        layout_id=layout.id,
        starts_at=starts_at,
        base_price=min(prices),
        seats_total=capacity,
        seats_available=capacity,
    )
    session.add(db_session)
    await session.flush()
    await session.execute(
        insert(SessionZonePrice),
        [
            {"session_id": db_session.id, "price_zone_id": zone.id, "price": price}
            for zone, price in zip(zones, prices, strict=True)
        ],
    )
    await session.flush()
    return db_session
