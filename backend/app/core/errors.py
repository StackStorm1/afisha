from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from enum import StrEnum

class ErrorCode(StrEnum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = 'UNAUTHORIZED'
    FORBIDDEN = 'FORBIDDEN'
    NOT_FOUND = 'NOT_FOUND'
    EMAIL_ALREADY_TAKEN = 'EMAIL_ALREADY_TAKEN'
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS'
    SESSION_NOT_ACTIVE = 'SESSION_NOT_ACTIVE'
    SESSION_IN_PAST = 'SESSION_IN_PAST'
    SESSION_ALREADY_CANCELLED = 'SESSION_ALREADY_CANCELLED'
    SEAT_ALREADY_TAKEN = 'SEAT_ALREADY_TAKEN'
    ORDER_NOT_CANCELLABLE = 'ORDER_NOT_CANCELLABLE'
    ORDER_ALREADY_PAID = 'ORDER_ALREADY_PAID'
    BOOKING_EXPIRED = 'BOOKING_EXPIRED'
    SESSION_ALREADY_STARTED = 'SESSION_ALREADY_STARTED'
    VENUE_BUSY = 'VENUE_BUSY'
    PAYMENT_FAILED = 'PAYMENT_FAILED'
    TOKEN_EXPIRED = 'TOKEN_EXPIRED'
    INTERNAL_ERROR = 'INTERNAL_ERROR'
    
def _body(code: str, message: str, details: list | None = None) -> dict:
    result: dict = {"code": code, "message": message}
    if details:
        result["details"] = details
    return result


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict):
        code = detail.get("code", "ERROR")
        message = detail.get("message", "Ошибка")
        details = detail.get("details")
    else:
        code = "ERROR"
        message = str(detail) if detail else "Ошибка"
        details = None
    return JSONResponse(
        status_code=exc.status_code, content=_body(code, message, details)
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    details = []
    for error in exc.errors():
        loc = [str(p) for p in error.get("loc", []) if p != "body"]
        details.append(
            {
                "field": ".".join(loc) if loc else "unknown",
                "message": error.get("msg", ""),
            }
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_body("VALIDATION_ERROR", "Ошибка валидации", details),
    )
