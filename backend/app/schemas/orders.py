from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.schemas.cities import City


class OrderStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"


from app.schemas.primitives import Money, Pagination

MAX_TICKETS_PER_ORDER = 10


class StandingRequest(BaseModel):
    section_id: UUID = Field(..., description="Стоячая зона из схемы зала сеанса")
    quantity: int = Field(..., ge=1, le=MAX_TICKETS_PER_ORDER, examples=[2])


class CreateOrderRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": (
                "Места и билеты в стоячие зоны вместе — от 1 до "
                f"{MAX_TICKETS_PER_ORDER} билетов. Стоячую зону покупают "
                "количеством: конкретные единицы выбирает сервер."
            )
        }
    )
    session_id: UUID
    seat_ids: list[UUID] = Field(
        default_factory=list,
        description="UUID мест сидячих секторов, выбранных на схеме зала",
        max_length=MAX_TICKETS_PER_ORDER,
    )
    standing: list[StandingRequest] = Field(
        default_factory=list, max_length=MAX_TICKETS_PER_ORDER
    )


class BookedSection(BaseModel):
    id: UUID
    name: str = Field(..., examples=["Сектор A"])
    kind: Literal["seated", "standing"]


class BookedZone(BaseModel):
    id: UUID
    name: str = Field(..., examples=["Партер"])


class BookedSeat(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": (
                "Билет в составе заказа: место сидячего сектора или единица "
                "стоячей зоны. У единицы стоячей зоны ряд и место — null."
            )
        }
    )

    id: UUID
    section: BookedSection
    row_label: str | None = Field(..., examples=["5"])
    seat_label: str | None = Field(..., examples=["12"])
    price_zone: BookedZone
    price: Money


class OrderEventRef(BaseModel):
    id: UUID
    title: str = Field(..., examples=["Гамлет"])
    poster_url: str | None = Field(
        None, examples=["https://cdn.example.com/hamlet.jpg"]
    )


class OrderVenueRef(BaseModel):
    name: str = Field(..., examples=["Большой театр"])
    address: str = Field(..., examples=["Театральная пл., 1"])
    city: City


class OrderSessionRef(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"description": "Краткая информация о сеансе внутри брони"}
    )
    id: UUID
    event: OrderEventRef
    venue: OrderVenueRef
    starts_at: AwareDatetime
    price: Money


class OrderDetail(BaseModel):
    id: UUID
    session: OrderSessionRef
    seats: list[BookedSeat]
    total_price: Money
    status: OrderStatus = Field(..., examples=["pending"])
    expires_at: AwareDatetime | None = Field(
        None,
        description="Время истечения удержания мест. Заполнено только для статуса pending (BR-02).",
        examples=["2026-10-01T10:15:00Z"],
    )
    created_at: AwareDatetime
    updated_at: AwareDatetime


class OrderListResponse(BaseModel):
    data: list[OrderDetail]
    pagination: Pagination


class OrderDetailResponse(BaseModel):
    data: OrderDetail
