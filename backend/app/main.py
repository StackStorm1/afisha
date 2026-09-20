import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import admin, auth, categories, cities, events, orders, sessions
from app.core.config import get_settings
from app.core.errors import http_exception_handler, validation_exception_handler
from app.core.logging import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    setup_logging(get_settings().log_level)
    yield


app = FastAPI(lifespan=lifespan)

_settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

PREFIX = "/api/v1"

app.include_router(auth.router, prefix=PREFIX)
app.include_router(cities.router, prefix=PREFIX)
app.include_router(categories.router, prefix=PREFIX)
app.include_router(events.router, prefix=PREFIX)
app.include_router(sessions.router, prefix=PREFIX)
app.include_router(orders.router, prefix=PREFIX)
app.include_router(admin.router, prefix=PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok"}
