from pydantic import BaseModel


class ErrorDetail(BaseModel):
    field: str | None = None
    seat_id: str | None = None
    message: str


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] | None = None
