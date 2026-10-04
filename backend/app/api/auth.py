from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, current_user
from app.models.users import User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UserProfile,
    UserProfileResponse,
)
from app.schemas.errors import ErrorResponse
from app.services import auth as auth_service

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
async def register(body: RegisterRequest, db: DbSession):
    data = await auth_service.register(db, body.email, body.password)
    return {"data": data.model_dump(mode="json")}


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
async def login(body: LoginRequest, db: DbSession):
    data = await auth_service.login(db, body.email, body.password)
    return {"data": data.model_dump(mode="json")}


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
async def get_me(user: Annotated[User, Depends(current_user)]):
    return {
        "data": UserProfile(
            id=user.id,
            email=user.email,
            role=user.role.lower(),
            created_at=user.created_at,
        ).model_dump(mode="json")
    }
