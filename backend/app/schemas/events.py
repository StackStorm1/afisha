from app.enums import AgeRating
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.schemas.categories import Category
from app.schemas.primitives import Money, Pagination


class EventBase(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": (
                "Базовое представление события (без вычисляемых полей по сеансам)"
            )
        },
        from_attributes=True,
    )

    id: UUID
    title: str = Field(..., max_length=255, examples=["Гамлет"])
    description: str | None = Field(
        None, examples=["Трагедия Шекспира в постановке Товстоногова."]
    )
    category: Category
    age_rating: AgeRating
    poster_url: str | None = Field(
        None, max_length=500, examples=["https://cdn.example.com/hamlet.jpg"]
    )
    created_at: AwareDatetime
    updated_at: AwareDatetime


class EventSummary(EventBase):
    model_config = ConfigDict(
        json_schema_extra={
            "description": (
                "Представление события для каталога и карточки. Дополняет `EventBase` "
                "полями, вычисленными по активным сеансам события."
                ""
                "Все три поля обязательны: и каталог, и карточка отдают только события, "
                "у которых есть хотя бы один активный сеанс (US-01, US-04), поэтому "
                "ближайшая дата и минимальная цена всегда определены. Ответы, где сеансов "
                "может не быть — создание и редактирование события администратором, — "
                "используют `EventBase`."
            )
        },
        from_attributes=True,
    )
    nearest_session_at: AwareDatetime = Field(
        ..., description="Время начала ближайшего активного сеанса"
    )
    min_price: Money = Field(
        ..., description="Минимальная цена среди активных сеансов события"
    )
    sessions_count: int = Field(..., ge=1, examples=[5])


class EventDetail(EventSummary):
    pass


class EventResponse(BaseModel):
    data: EventDetail


class EventBaseResponse(BaseModel):    
    data: EventBase
    
class EventListResponse(BaseModel):
    data: list[EventSummary]
    pagination: Pagination


class CreateEventRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None)
    category_id: int
    age_rating: AgeRating
    poster_url: str | None = Field(None, max_length=500)


class UpdateEventRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "description": "Все поля опциональны — передавать только изменяемые"
        },
        extra="forbid"
    )

    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None)
    category_id: int | None = Field(None, ge=1)
    age_rating: AgeRating | None = Field(None)
    poster_url: str | None = Field(None, max_length=500)
    
    @model_validator(mode="before")
    @classmethod
    def validate_body(cls, data):
        non_null_fields = {"title", "category_id"}
        for field, value in data.items():
            if value is None and field in non_null_fields:
                raise ValueError(f"{field} cannot be null")
        if not data:
            raise ValueError(f"Необходимо передать хотя бы одно поле")
        return data

