from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.primitives import Pagination
from app.schemas.cities import City


class Venue(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str = Field(max_length=255, examples=["Большой театр"])
    address: str = Field(max_length=500, examples=["Театральная пл., 1"])
    city: City
    rows_count: int = Field(ge=1, le=100, examples=[20])
    seats_per_row: int = Field(ge=1, le=100, examples=[30])


class CreateVenueRequest(BaseModel):
    name: str = Field(..., max_length=255, examples=["Большой театр"])
    address: str = Field(..., max_length=500, examples=["Театральная пл., 1"])
    city_id: int = Field(
        ...,
        description="ID города. В MVP единственный город — Москва (id=1).",
        examples=[1],
    )
    rows_count: int = Field(..., ge=1, le=100, examples=[20])
    seats_per_row: int = Field(..., ge=1, le=100, examples=[30])


class UpdateVenueRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": (
                "Все поля опциональны — передавать только изменяемые. "
                "Геометрия зала (`rows_count`, `seats_per_row`) и город не редактируются: "
                "по ним уже сгенерированы места, на которые ссылаются брони (BR-08)."
            )
        },
        extra="forbid"
    )
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = Field(default=None, min_length=1, max_length=500)
    
    @model_validator(mode="before")
    @classmethod
    def validate_body(cls, data):
        for field, value in data.items():
            if value is None and field in {"name","address"}:
                raise ValueError(f"{field} cannot be null")
        if not data:
            raise ValueError(f"Необходимо передать хотя бы одно поле")
        return data
            
    

class VenueResponse(BaseModel):
    data: Venue
    

class VenueListResponse(BaseModel):
    data: list[Venue]
    pagination: Pagination    
