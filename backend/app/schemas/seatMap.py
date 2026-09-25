from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.enums import PriceCategory, SeatStatus, SessionStatus
from app.schemas.primitives import Money


class SeatInfo(BaseModel):
    id: UUID
    seat_no: int = Field(..., ge=1, examples=[12])
    price_category: PriceCategory = Field(
        ...,
        description="Ценовая категория места. В БД — в верхнем регистре.",
        examples=["stalls"],
    )
    price: Money
    status: SeatStatus = Field(
        ...,
        description="Публичное состояние места: `free` — свободно, `held` — удерживается чьей-то бронью, `paid` — продано. Истёкшие брони не учитываются, такое место снова `free`.",
        examples=["free"],
    )
    held_by_me: bool = Field(
        False,
        description="Место удерживается текущим пользователем. Всегда `false` для гостя и для запроса без токена. Даёт третье состояние схемы зала из US-10 («выбрано мной») и переживает перезагрузку страницы: фронт находит свои места и продолжает отсчёт по `expires_at` своего заказа (US-12).",
    )


class SeatRow(BaseModel):
    row_no: int = Field(..., ge=1, examples=[5])
    seats: list[SeatInfo]


class SeatMap(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": "Схема зала с актуальным статусом каждого места"
        }
    )
    session_id: UUID
    status: SessionStatus = Field(..., examples=["active"])
    price: Money = Field(
        ...,
        description="Базовая цена сеанса. Цена конкретного места — `price` внутри `SeatInfo`: `base_price × seats.price_factor` (db-schema §3.5).",
    )
    rows: list[SeatRow] = Field(
        ..., description="Ряды от сцены, места в ряду слева направо"
    )


class CreateSessionRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": (
                "`total_seats` не передаётся: сервер берёт его как "
                "`rows_count × seats_per_row` площадки и сохраняет снимком (db-schema §3.7)."
            )
        }
    )
    venue_id: UUID
    starts_at: AwareDatetime
    price: Money = Field(
        ..., description="Базовая цена сеанса, умножается на price_factor места"
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
