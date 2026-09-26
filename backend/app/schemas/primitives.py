from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, PlainSerializer

Money = Annotated[
    Decimal,
    Field(ge=0),
    PlainSerializer(lambda v: f"{v:.2f}", return_type=str),
]


class Pagination(BaseModel):
    page: int = Field(ge=1)
    per_page: int = Field(ge=1)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)
