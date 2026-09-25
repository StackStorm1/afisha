from fastapi import APIRouter

from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UserProfileResponse,
)
from app.schemas.errors import ErrorResponse
from app.stubs.fixtures import AUTH_RESPONSE, USER

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    status_code=201,
    response_model=AuthResponse,
    summary="Регистрация пользователя (US-08)",
    responses={
        409: {"model": ErrorResponse, "description": "Email уже зарегистрирован"},
        422: {"model": ErrorResponse, "description": "Ошибка валидации"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def register(body: RegisterRequest):
    return AUTH_RESPONSE.model_dump(mode="json")


@router.post(
    "/login",
    status_code=200,
    response_model=AuthResponse,
    summary="Вход пользователя (US-09)",
    responses={
        401: {"model": ErrorResponse, "description": "Неверный email или пароль"},
        422: {"model": ErrorResponse, "description": "Ошибка валидации"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def login(body: LoginRequest):
    return AUTH_RESPONSE.model_dump(mode="json")


@router.get(
    "/me",
    status_code=200,
    response_model=UserProfileResponse,
    summary="Профиль текущего пользователя",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def get_me():
    return {"data": USER.model_dump(mode="json")}
