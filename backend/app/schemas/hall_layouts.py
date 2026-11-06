from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.schemas.primitives import Money

CANVAS_WIDTH = 840
CANVAS_HEIGHT = 640


class SectionKind(StrEnum):
    SEATED = "seated"
    STANDING = "standing"


Point = list[float]


class ZoneRange(BaseModel):
    from_row: int = Field(..., ge=1)
    to_row: int = Field(..., ge=1)
    price_zone_id: str = Field(
        ..., description="id ценовой зоны из этой же конфигурации (черновика)"
    )


class SeatGenerator(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": (
                "Параметры сидячего сектора. Места строятся по ним: число мест "
                "в ряду растёт равномерно от `seats_first` у сцены до "
                "`seats_last` в последнем ряду."
            )
        }
    )
    rows_count: int = Field(..., ge=0, le=100, examples=[12])
    seats_first: int = Field(..., ge=0, le=200, examples=[24])
    seats_last: int = Field(..., ge=0, le=200, examples=[36])
    numbering: Literal["numeric", "letters"] = "numeric"
    zone_ranges: list[ZoneRange] = Field(default_factory=list)


# ─── Черновик конфигурации (запрос) ──────────────────────────────────────────


class PriceZoneDraft(BaseModel):
    id: str = Field(
        ...,
        min_length=1,
        description="id зоны в черновике. Сервер выдаёт свои id и перешивает ссылки",
    )
    name: str = Field(..., min_length=1, max_length=100, examples=["Партер"])
    sort_order: int = Field(..., ge=1, examples=[1])


class SectionDraft(BaseModel):
    id: str | None = None
    name: str = Field(..., max_length=100, examples=["Сектор A"])
    kind: SectionKind
    shape: list[Point] = Field(
        ...,
        min_length=3,
        description="Контур сектора — полигон `[[x, y], …]` на холсте",
    )
    sort_order: int = Field(..., ge=1)
    generator: SeatGenerator | None = None
    price_zone_id: str | None = None
    capacity: int | None = Field(None, ge=0, le=100_000)

    @model_validator(mode="after")
    def check_kind_fields(self):
        if any(len(point) != 2 for point in self.shape):
            raise ValueError("Точка контура — пара [x, y]")
        if self.kind == SectionKind.SEATED and self.generator is None:
            raise ValueError("У сидячего сектора нужен generator")
        if self.kind == SectionKind.STANDING and self.capacity is None:
            raise ValueError("У стоячей зоны нужна capacity")
        return self


class HallLayoutDraft(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": (
                "Конфигурация целиком. Ошибки схемы (пересечения, пустые "
                "сектора, ряды без зоны) сервер проверяет так же, как редактор."
            )
        }
    )
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field("", max_length=2000)
    canvas_width: int = Field(CANVAS_WIDTH, ge=1, le=10_000)
    canvas_height: int = Field(CANVAS_HEIGHT, ge=1, le=10_000)
    price_zones: list[PriceZoneDraft] = Field(..., min_length=1)
    sections: list[SectionDraft] = Field(..., min_length=1)

    @model_validator(mode="after")
    def check_unique_zones(self):
        if len({zone.id for zone in self.price_zones}) != len(self.price_zones):
            raise ValueError("id ценовых зон повторяются")
        if len({z.sort_order for z in self.price_zones}) != len(self.price_zones):
            raise ValueError("sort_order ценовых зон повторяется")
        return self


# ─── Конфигурация (ответ) ────────────────────────────────────────────────────


class PriceZone(BaseModel):
    id: UUID
    name: str
    sort_order: int


class LayoutSeat(BaseModel):
    id: UUID
    row_label: str = Field(..., examples=["1"])
    seat_label: str = Field(..., examples=["12"])
    price_zone_id: UUID
    x: float
    y: float


class Section(BaseModel):
    id: UUID
    name: str
    kind: SectionKind
    shape: list[Point]
    sort_order: int
    generator: SeatGenerator | None = Field(
        None, description="Только у сидячего сектора"
    )
    seats: list[LayoutSeat] | None = Field(None, description="Только у сидячего")
    price_zone_id: UUID | None = Field(None, description="Только у стоячей зоны")
    capacity: int | None = Field(None, description="Только у стоячей зоны")


class HallLayout(BaseModel):
    id: UUID
    venue_id: UUID
    name: str
    description: str
    canvas_width: int
    canvas_height: int
    is_archived: bool
    created_at: AwareDatetime
    price_zones: list[PriceZone]
    sections: list[Section]


class HallLayoutSummary(BaseModel):
    id: UUID
    venue_id: UUID
    name: str
    description: str
    is_archived: bool
    created_at: AwareDatetime
    sessions_count: int = Field(..., ge=0)


class HallLayoutResponse(BaseModel):
    data: HallLayout


class HallLayoutListResponse(BaseModel):
    data: list[HallLayoutSummary]


class LayoutRevisionResponse(BaseModel):
    data: HallLayout
    revision: Literal["updated", "created"] = Field(
        ...,
        description=(
            "`updated` — сеансов на конфигурации не было, она изменена на месте. "
            "`created` — создана новая конфигурация, старая ушла в архив и "
            "осталась у своих сеансов."
        ),
    )


# ─── Схема зала сеанса ───────────────────────────────────────────────────────


class ZonePrice(BaseModel):
    price_zone_id: UUID
    price: Money


class SessionHall(BaseModel):
    session_id: UUID
    layout_id: UUID
    prices: list[ZonePrice]
    sold_count: int = Field(
        ...,
        ge=0,
        description="Активных броней и проданных билетов. Пока > 0, схему и цены не сменить",
    )


class SaveSessionHallRequest(BaseModel):
    layout_id: UUID
    prices: list[ZonePrice] = Field(
        ..., description="Цена на каждую ценовую зону конфигурации"
    )


class SessionHallResponse(BaseModel):
    data: SessionHall
