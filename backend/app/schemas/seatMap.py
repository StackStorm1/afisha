from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.enums import SeatStatus
from app.schemas.primitives import Money


class SessionStatus(StrEnum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class SeatMapLayout(BaseModel):
    id: UUID
    name: str = Field(..., examples=["Танцпол + трибуны"])
    canvas_width: int = Field(..., examples=[840])
    canvas_height: int = Field(..., examples=[640])


class SeatMapZone(BaseModel):
    id: UUID
    name: str = Field(..., examples=["Партер"])
    sort_order: int = Field(
        ..., description="От дорогой зоны к дешёвой; по нему фронт выбирает цвет"
    )
    price: Money = Field(..., description="Цена билета в зоне на этом сеансе")
    available: int = Field(
        ..., ge=0, description="Свободных мест и стоячих единиц в зоне"
    )


class SeatInfo(BaseModel):
    id: UUID
    row_label: str = Field(..., examples=["5"])
    seat_label: str = Field(..., examples=["12"])
    x: float = Field(..., description="Центр места на холсте конфигурации")
    y: float
    price_zone_id: UUID
    status: SeatStatus = Field(
        ...,
        description="Публичное состояние места: `free` — свободно, `held` — удерживается чьей-то бронью, `paid` — продано. Истёкшие брони не учитываются, такое место снова `free`.",
        examples=["free"],
    )
    held_by_me: bool = Field(
        False,
        description="Место удерживается текущим пользователем. Всегда `false` для гостя и для запроса без токена. Даёт третье состояние схемы зала из US-10 («выбрано мной») и переживает перезагрузку страницы: фронт находит свои места и продолжает отсчёт по `expires_at` своего заказа (US-12).",
    )


class SeatedSection(BaseModel):
    id: UUID
    name: str = Field(..., examples=["Сектор A"])
    kind: Literal["seated"] = "seated"
    shape: list[list[float]]
    seats: list[SeatInfo]


class StandingSection(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": (
                "Стоячая зона: мест нет, наружу отдаются только счётчики. "
                "Билеты в неё покупаются количеством (`standing` в CreateOrderRequest)."
            )
        }
    )
    id: UUID
    name: str = Field(..., examples=["Танцпол"])
    kind: Literal["standing"] = "standing"
    shape: list[list[float]]
    price_zone_id: UUID
    capacity: int = Field(..., ge=1)
    available: int = Field(..., ge=0)
    held_by_me: int = Field(
        0, ge=0, description="Сколько единиц зоны держит текущий пользователь"
    )


class SeatMap(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": "Схема зала сеанса по секторам с актуальным статусом мест"
        }
    )
    session_id: UUID
    status: SessionStatus = Field(..., examples=["active"])
    layout: SeatMapLayout
    price_zones: list[SeatMapZone] = Field(..., description="По sort_order")
    sections: list[SeatedSection | StandingSection]


class CreateSessionRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": (
                "`total_seats` не передаётся: сервер берёт его снимком "
                "вместимости конфигурации зала по умолчанию."
            )
        }
    )
    venue_id: UUID
    starts_at: AwareDatetime
    price: Money = Field(
        ...,
        description="Стартовая цена; цены зон задаются через /admin/sessions/{id}/hall",
    )


class UpdateSessionRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": (
                "Все поля опциональны — передавать только изменяемые. "
                "`total_seats` производен от площадки и не редактируется."
            )
        }
    )
    venue_id: UUID | None = None
    starts_at: AwareDatetime | None = None
    price: Money | None = None


class SeatMapResponse(BaseModel):
    data: SeatMap
