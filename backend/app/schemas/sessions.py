from pydantic import BaseModel, Field, ConfigDict, AwareDatetime
from uuid import UUID
from app.schemas.venues import Venue
from app.schemas.cities import City
from app.schemas.primitives import Money
from enum import StrEnum

class SessionStatus(StrEnum):
    ACTIVE = 'active'
    CANCELLED = 'cancelled'
    COMPLETED = 'completed'    

class Session(BaseModel):
    id: UUID
    event_id: UUID
    venue: Venue
    city: City
    starts_at: AwareDatetime
    price: Money
    total_seats: int = Field(..., ge=1, json_schema_extra={'readOnly': True}, description='Вместимость площадки на момент создания сеанса (снимок)', examples=[300])
    seats_left: int = Field(..., ge=0, examples=[142])
    status: SessionStatus = Field(..., examples=['active'])

class UpdateSessionRequest(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        'description': 'Все поля опциональны — передавать только изменяемые. `total_seats` производен от площадки и не редактируется.'
    })
    venue_id: UUID | None = Field(None, description='Смена площадки допустима, пока по сеансу нет активных броней')
    starts_at: AwareDatetime | None = Field(None)
    price: Money | None = Field(None)
    