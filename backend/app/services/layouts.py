from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ErrorCode
from app.enums import BookingStatus
from app.enums import SectionKind as OrmSectionKind
from app.models.bookings import Booking
from app.models.hall_layouts import HallLayout as HallLayoutModel
from app.models.price_zones import PriceZone as PriceZoneModel
from app.models.seats import Seat
from app.models.sections import Section as SectionModel
from app.models.session_zone_prices import SessionZonePrice
from app.models.sessions import Session
from app.models.venues import Venue
from app.schemas.hall_layouts import (
    HallLayout,
    HallLayoutDraft,
    HallLayoutSummary,
    LayoutSeat,
    PriceZone,
    SaveSessionHallRequest,
    Section,
    SectionKind,
    SessionHall,
    ZonePrice,
)
from app.services.hall_geometry import generate_seats
from app.services.layout_issues import layout_issues

# Вставка мест порциями: у стадиона одна стоячая зона — тысячи строк.
_SEAT_CHUNK = 2000


def _not_found(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": ErrorCode.NOT_FOUND, "message": message},
    )


def _validation_error(details: list[dict[str, str]]) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "code": ErrorCode.VALIDATION_ERROR,
            "message": "Ошибка валидации",
            "details": details,
        },
    )


# ─── Черновик → строки таблиц ────────────────────────────────────────────────


@dataclass
class LayoutRows:
    """Строки price_zones, sections и seats одной конфигурации."""

    zones: list[dict[str, Any]] = field(default_factory=list)
    sections: list[dict[str, Any]] = field(default_factory=list)
    seats: list[dict[str, Any]] = field(default_factory=list)


def materialize(
    draft: dict[str, Any],
    layout_id: UUID,
    new_id: Callable[[], UUID] = uuid4,
) -> LayoutRows:
    """Разворачивает черновик (форма API) в строки таблиц.

    id зон и секторов выдаются заново, ссылки на зоны в генераторах и
    стоячих зонах перешиваются: id черновика — чужие (редактора или
    архивной конфигурации). Места сидячих секторов строит генератор,
    стоячая зона вместимостью N разворачивается в N безымянных единиц.
    Сид передаёт свой new_id, чтобы данные были воспроизводимы.
    """
    zone_ids = {zone["id"]: new_id() for zone in draft["price_zones"]}
    rows = LayoutRows(
        zones=[
            {
                "id": zone_ids[zone["id"]],
                "layout_id": layout_id,
                "name": zone["name"],
                "sort_order": zone["sort_order"],
            }
            for zone in draft["price_zones"]
        ]
    )

    for section in draft["sections"]:
        section_id = new_id()
        row = {
            "id": section_id,
            "layout_id": layout_id,
            "name": section["name"],
            "kind": OrmSectionKind(section["kind"].upper()),
            "shape": section["shape"],
            "sort_order": section["sort_order"],
            "generator": None,
            "price_zone_id": None,
            "capacity": None,
        }
        if section["kind"] == SectionKind.SEATED:
            generator = section["generator"]
            row["generator"] = {
                **generator,
                "zone_ranges": [
                    {**r, "price_zone_id": str(zone_ids[r["price_zone_id"]])}
                    for r in generator["zone_ranges"]
                    if r["price_zone_id"] in zone_ids
                ],
            }
            for unit_no, seat in enumerate(generate_seats(section), start=1):
                rows.seats.append(
                    {
                        "id": new_id(),
                        "section_id": section_id,
                        "price_zone_id": zone_ids[seat["price_zone_id"]],
                        "unit_no": unit_no,
                        "row_label": seat["row_label"],
                        "seat_label": seat["seat_label"],
                        "x": seat["x"],
                        "y": seat["y"],
                    }
                )
        else:
            zone_id = zone_ids[section["price_zone_id"]]
            row["price_zone_id"] = zone_id
            row["capacity"] = section["capacity"]
            rows.seats.extend(
                {
                    "id": new_id(),
                    "section_id": section_id,
                    "price_zone_id": zone_id,
                    "unit_no": unit_no,
                    "row_label": None,
                    "seat_label": None,
                    "x": None,
                    "y": None,
                }
                for unit_no in range(1, section["capacity"] + 1)
            )
        rows.sections.append(row)
    return rows


def _check_draft(draft: HallLayoutDraft) -> dict[str, Any]:
    data = draft.model_dump(mode="json")
    issues = layout_issues(data)
    if issues:
        raise _validation_error(
            [{"field": "sections", "message": issue} for issue in issues]
        )
    return data


async def _write_children(db: AsyncSession, layout_id: UUID, draft: dict) -> None:
    rows = materialize(draft, layout_id)
    await db.execute(insert(PriceZoneModel), rows.zones)
    await db.execute(insert(SectionModel), rows.sections)
    for start in range(0, len(rows.seats), _SEAT_CHUNK):
        await db.execute(insert(Seat), rows.seats[start : start + _SEAT_CHUNK])


# ─── Чтение ──────────────────────────────────────────────────────────────────


async def _layout_schema(db: AsyncSession, layout: HallLayoutModel) -> HallLayout:
    zones = (
        await db.execute(
            select(PriceZoneModel)
            .where(PriceZoneModel.layout_id == layout.id)
            .order_by(PriceZoneModel.sort_order)
        )
    ).scalars()
    sections = (
        (
            await db.execute(
                select(SectionModel)
                .where(SectionModel.layout_id == layout.id)
                .order_by(SectionModel.sort_order, SectionModel.id)
            )
        )
        .scalars()
        .all()
    )
    seats = (
        await db.execute(
            select(Seat)
            .join(SectionModel, SectionModel.id == Seat.section_id)
            .where(
                SectionModel.layout_id == layout.id,
                SectionModel.kind == OrmSectionKind.SEATED,
            )
            .order_by(Seat.section_id, Seat.unit_no)
        )
    ).scalars()
    seats_by_section: dict[UUID, list[LayoutSeat]] = {}
    for seat in seats:
        seats_by_section.setdefault(seat.section_id, []).append(
            LayoutSeat(
                id=seat.id,
                row_label=seat.row_label,
                seat_label=seat.seat_label,
                price_zone_id=seat.price_zone_id,
                x=float(seat.x),
                y=float(seat.y),
            )
        )

    return HallLayout(
        id=layout.id,
        venue_id=layout.venue_id,
        name=layout.name,
        description=layout.description,
        canvas_width=layout.canvas_width,
        canvas_height=layout.canvas_height,
        is_archived=layout.is_archived,
        created_at=layout.created_at,
        price_zones=[
            PriceZone(id=z.id, name=z.name, sort_order=z.sort_order) for z in zones
        ],
        sections=[
            Section(
                id=s.id,
                name=s.name,
                kind=SectionKind(s.kind.lower()),
                shape=s.shape,
                sort_order=s.sort_order,
                generator=s.generator,
                seats=seats_by_section.get(s.id, [])
                if s.kind == OrmSectionKind.SEATED
                else None,
                price_zone_id=s.price_zone_id,
                capacity=s.capacity,
            )
            for s in sections
        ],
    )


async def _require_layout(
    db: AsyncSession, layout_id: UUID, *, lock: bool = False
) -> HallLayoutModel:
    stmt = select(HallLayoutModel).where(HallLayoutModel.id == layout_id)
    if lock:
        stmt = stmt.with_for_update()
    layout = (await db.execute(stmt)).scalar_one_or_none()
    if layout is None:
        raise _not_found("Конфигурация зала не найдена")
    return layout


async def _require_venue(db: AsyncSession, venue_id: UUID) -> Venue:
    venue = await db.get(Venue, venue_id)
    if venue is None:
        raise _not_found("Площадка не найдена")
    return venue


async def list_venue_layouts(
    db: AsyncSession, venue_id: UUID
) -> list[HallLayoutSummary]:
    await _require_venue(db, venue_id)
    sessions_count = (
        select(func.count())
        .where(Session.layout_id == HallLayoutModel.id)
        .correlate(HallLayoutModel)
        .scalar_subquery()
    )
    rows = await db.execute(
        select(HallLayoutModel, sessions_count)
        .where(
            HallLayoutModel.venue_id == venue_id,
            HallLayoutModel.is_archived.is_(False),
        )
        .order_by(HallLayoutModel.position)
    )
    return [
        HallLayoutSummary(
            id=layout.id,
            venue_id=layout.venue_id,
            name=layout.name,
            description=layout.description,
            is_archived=layout.is_archived,
            created_at=layout.created_at,
            sessions_count=count,
        )
        for layout, count in rows
    ]


async def get_layout(db: AsyncSession, layout_id: UUID) -> HallLayout:
    return await _layout_schema(db, await _require_layout(db, layout_id))


# ─── Запись ──────────────────────────────────────────────────────────────────


async def create_layout(
    db: AsyncSession, venue_id: UUID, draft: HallLayoutDraft
) -> HallLayout:
    """Новая конфигурация встаёт в конец списка площадки."""
    # Блокировка площадки упорядочивает параллельные создания: иначе два
    # запроса получат одну и ту же следующую позицию.
    venue = (
        await db.execute(select(Venue).where(Venue.id == venue_id).with_for_update())
    ).scalar_one_or_none()
    if venue is None:
        raise _not_found("Площадка не найдена")
    data = _check_draft(draft)

    position = (
        await db.execute(
            select(func.coalesce(func.max(HallLayoutModel.position) + 1, 0)).where(
                HallLayoutModel.venue_id == venue_id
            )
        )
    ).scalar_one()
    layout = HallLayoutModel(
        venue_id=venue_id,
        name=data["name"].strip(),
        description=data["description"],
        canvas_width=data["canvas_width"],
        canvas_height=data["canvas_height"],
        position=position,
    )
    db.add(layout)
    await db.flush()
    await _write_children(db, layout.id, data)
    await db.commit()
    await db.refresh(layout)
    return await _layout_schema(db, layout)


async def save_revision(
    db: AsyncSession, layout_id: UUID, draft: HallLayoutDraft
) -> tuple[HallLayout, str]:
    """Сохранить правку конфигурации.

    Конфигурацию, на которую уже есть сеансы, не меняют: создаётся новая на
    той же позиции в списке площадки, старая уходит в архив и остаётся у
    этих сеансов. Будущие сеансы получают уже новую.
    """
    current = await _require_layout(db, layout_id, lock=True)
    if current.is_archived:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": ErrorCode.LAYOUT_ARCHIVED,
                "message": "Конфигурация в архиве, её нельзя изменить",
            },
        )
    data = _check_draft(draft)
    fields = {
        "name": data["name"].strip(),
        "description": data["description"],
        "canvas_width": data["canvas_width"],
        "canvas_height": data["canvas_height"],
    }

    has_sessions = (
        await db.execute(
            select(Session.id).where(Session.layout_id == layout_id).limit(1)
        )
    ).first() is not None

    if not has_sessions:
        # Сеансов нет — значит, нет и броней на места: старые зоны, сектора
        # и места можно удалить и построить заново.
        await db.execute(
            delete(SectionModel).where(SectionModel.layout_id == layout_id)
        )
        await db.execute(
            delete(PriceZoneModel).where(PriceZoneModel.layout_id == layout_id)
        )
        await db.execute(
            update(HallLayoutModel)
            .where(HallLayoutModel.id == layout_id)
            .values(**fields)
        )
        await _write_children(db, layout_id, data)
        target, revision = layout_id, "updated"
    else:
        await db.execute(
            update(HallLayoutModel)
            .where(HallLayoutModel.id == layout_id)
            .values(is_archived=True)
        )
        created = HallLayoutModel(
            venue_id=current.venue_id, position=current.position, **fields
        )
        db.add(created)
        await db.flush()
        await _write_children(db, created.id, data)
        target, revision = created.id, "created"

    await db.commit()
    layout = await db.get(HallLayoutModel, target, populate_existing=True)
    return await _layout_schema(db, layout), revision


# ─── Схема зала сеанса ───────────────────────────────────────────────────────


async def _sold_count(db: AsyncSession, session_id: UUID) -> int:
    return (
        await db.execute(
            select(func.count()).where(
                Booking.session_id == session_id,
                Booking.status.in_([BookingStatus.HELD, BookingStatus.PAID]),
            )
        )
    ).scalar_one()


async def _session_hall(db: AsyncSession, session: Session) -> SessionHall:
    prices = (
        await db.execute(
            select(SessionZonePrice.price_zone_id, SessionZonePrice.price)
            .join(PriceZoneModel, PriceZoneModel.id == SessionZonePrice.price_zone_id)
            .where(SessionZonePrice.session_id == session.id)
            .order_by(PriceZoneModel.sort_order)
        )
    ).all()
    return SessionHall(
        session_id=session.id,
        layout_id=session.layout_id,
        prices=[ZonePrice(price_zone_id=z, price=p) for z, p in prices],
        sold_count=await _sold_count(db, session.id),
    )


async def get_session_hall(db: AsyncSession, session_id: UUID) -> SessionHall:
    session = await db.get(Session, session_id)
    if session is None:
        raise _not_found("Сеанс не найден")
    return await _session_hall(db, session)


async def save_session_hall(
    db: AsyncSession, session_id: UUID, body: SaveSessionHallRequest
) -> SessionHall:
    """Выбрать сеансу конфигурацию и задать цены зон.

    Пока на сеанс есть брони или проданные билеты, менять нельзя: проданные
    билеты уже посчитаны по старым местам и ценам. FOR UPDATE на сеансе
    ждёт идущие create_order (они держат FOR KEY SHARE), так что между
    проверкой и сменой новая бронь на старые места не появится.
    """
    session = (
        await db.execute(
            select(Session).where(Session.id == session_id).with_for_update()
        )
    ).scalar_one_or_none()
    if session is None:
        raise _not_found("Сеанс не найден")

    if await _sold_count(db, session_id) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": ErrorCode.SESSION_HAS_BOOKINGS,
                "message": "На сеанс уже есть брони или заказы, схему и цены изменить нельзя",
            },
        )

    layout = await db.get(HallLayoutModel, body.layout_id)
    if layout is None or layout.venue_id != session.venue_id:
        raise _validation_error(
            [{"field": "layout_id", "message": "Конфигурация другой площадки"}]
        )
    if layout.is_archived and layout.id != session.layout_id:
        raise _validation_error(
            [{"field": "layout_id", "message": "Конфигурация в архиве"}]
        )

    zones = (
        (
            await db.execute(
                select(PriceZoneModel)
                .where(PriceZoneModel.layout_id == layout.id)
                .order_by(PriceZoneModel.sort_order)
            )
        )
        .scalars()
        .all()
    )
    by_zone = {p.price_zone_id: p.price for p in body.prices}
    missing = [zone for zone in zones if zone.id not in by_zone]
    if missing:
        raise _validation_error(
            [
                {
                    "field": f"prices.{zone.id}",
                    "message": f"Укажите цену для зоны «{zone.name}»",
                }
                for zone in missing
            ]
        )

    capacity = (
        await db.execute(
            select(func.count())
            .select_from(Seat)
            .join(SectionModel, SectionModel.id == Seat.section_id)
            .where(SectionModel.layout_id == layout.id)
        )
    ).scalar_one()

    await db.execute(
        delete(SessionZonePrice).where(SessionZonePrice.session_id == session_id)
    )
    await db.execute(
        insert(SessionZonePrice),
        [
            {"session_id": session_id, "price_zone_id": z.id, "price": by_zone[z.id]}
            for z in zones
        ],
    )
    await db.execute(
        update(Session)
        .where(Session.id == session_id)
        .values(
            layout_id=layout.id,
            seats_total=capacity,
            seats_available=capacity,
            base_price=min(by_zone[z.id] for z in zones),
        )
    )
    await db.commit()
    await db.refresh(session)
    return await _session_hall(db, session)
