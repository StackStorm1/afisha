from enum import StrEnum
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.schemas.cities import City


class SessionStatus(StrEnum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


from app.schemas.primitives import Money, Pagination
from app.schemas.venues import Venue


class Session(BaseModel):
    id: UUID
    event_id: UUID
    venue: Venue
    city: City
    starts_at: AwareDatetime
    price: Money
    total_seats: int = Field(
        ...,
        ge=1,
        json_schema_extra={"readOnly": True},
        description="Вместимость площадки на момент создания сеанса (снимок)",
        examples=[300],
    )
    seats_left: int = Field(..., ge=0, examples=[142])
    status: SessionStatus = Field(..., examples=["active"])


class UpdateSessionRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": "Все поля опциональны — передавать только изменяемые. `total_seats` производен от площадки и не редактируется."
        },
        extra="forbid",
    )
    venue_id: UUID | None = Field(
        None,
        description="Смена площадки допустима, пока по сеансу нет активных броней",
    )
    starts_at: AwareDatetime | None = Field(None)
    price: Money | None = Field(None)

    @model_validator(mode="before")
    @classmethod
    def validate_body(cls, data):
        for field, value in data.items():
            if value is None and field in {"starts_at", "price"}:
                raise ValueError(f"{field} cannot be null")
        if not data:
            raise ValueError("Необходимо передать хотя бы одно поле")
        return data


class SessionResponse(BaseModel):
    data: Session


class SessionListResponse(BaseModel):
    data: list[Session]
    pagination: Pagination
