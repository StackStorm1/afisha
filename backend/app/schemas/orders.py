from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.enums import OrderStatus, PriceCategory
from app.schemas.cities import City
from app.schemas.primitives import Money, Pagination


class CreateOrderRequest(BaseModel):
    session_id: UUID
    seat_ids: list[UUID] = Field(
        ...,
        description="UUID мест, выбранных на схеме зала",
        min_length=1,
        max_length=10,
    )


class BookedSeat(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"description": "Место в составе заказа"}
    )

    id: UUID
    row_no: int = Field(..., ge=1, examples=[5])
    seat_no: int = Field(..., ge=1, examples=[12])
    price_category: PriceCategory = Field(
        ...,
        description="Ценовая категория места. В БД — в верхнем регистре.",
        examples=["stalls"],
    )
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
