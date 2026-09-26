from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import AgeRating, CategoryCode, UserRole
from app.models.categories import Category
from app.models.cities import City
from app.models.events import Event
from app.models.sessions import Session
from app.models.users import User
from app.models.venues import Venue


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
    rows_count: int = 10,
    seats_per_row: int = 20,
) -> Venue:
    venue = Venue(
        city_id=city.id,
        name=name,
        address=address,
        rows_count=rows_count,
        seats_per_row=seats_per_row,
    )
    session.add(venue)
    await session.flush()
    return venue


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
    starts_at: datetime | None = None,
    base_price: Decimal = Decimal("500.00"),
) -> Session:
    if starts_at is None:
        starts_at = datetime.now(UTC) + timedelta(days=7)
    db_session = Session(
        event_id=event.id,
        venue_id=venue.id,
        city_id=city.id,
        starts_at=starts_at,
        base_price=base_price,
        seats_total=venue.rows_count * venue.seats_per_row,
        seats_available=venue.rows_count * venue.seats_per_row,
    )
    session.add(db_session)
    await session.flush()
    return db_session
