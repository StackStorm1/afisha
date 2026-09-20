from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def _body(code: str, message: str, details: list | None = None) -> dict:
    result: dict = {"code": code, "message": message}
    if details:
        result["details"] = details
    return result


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict):
        code = detail.get("code", "ERROR")
        message = detail.get("message", "Ошибка")
        details = detail.get("details")
    else:
        code = "ERROR"
        message = str(detail) if detail else "Ошибка"
        details = None
    return JSONResponse(status_code=exc.status_code, content=_body(code, message, details))


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for error in exc.errors():
        loc = [str(p) for p in error.get("loc", []) if p != "body"]
        details.append({"field": ".".join(loc) if loc else "unknown", "message": error.get("msg", "")})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_body("VALIDATION_ERROR", "Ошибка валидации", details),
    )
