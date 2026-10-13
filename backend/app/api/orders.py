from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import DbSession, current_user
from app.models.users import User
from app.schemas.errors import ErrorResponse
from app.schemas.orders import (
    CreateOrderRequest,
    OrderDetailResponse,
    OrderListResponse,
    OrderStatus,
)
from app.services import orders as orders_service
from app.stubs.fixtures import ORDER, PAGINATION

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post(
    "",
    status_code=201,
    response_model=OrderDetailResponse,
    summary="Создание брони — выбор мест (US-11)",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        409: {
            "model": ErrorResponse,
            "description": "Сеанс неактивен или место уже занято",
        },
        422: {
            "model": ErrorResponse,
            "description": "Нарушены правила валидации полей",
        },
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def create_order(
    body: CreateOrderRequest,
    db: DbSession,
    user: Annotated[User, Depends(current_user)],
):
    order = await orders_service.create_order(db, body.session_id, body.seat_ids, user)
    return {"data": order.model_dump(mode="json")}


@router.get(
    "",
    status_code=200,
    response_model=OrderListResponse,
    summary="Мои брони (US-15)",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def list_orders(
    status: OrderStatus | None = Query(None, description="Фильтр по статусу брони"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    return {
        "data": [ORDER.model_dump(mode="json")],
        "pagination": PAGINATION.model_dump(mode="json"),
    }


@router.get(
    "/{id}",
    status_code=200,
    response_model=OrderDetailResponse,
    summary="Детали брони",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def get_order(id: UUID):
    return {"data": ORDER.model_dump(mode="json")}


@router.delete(
    "/{id}",
    status_code=200,
    response_model=OrderDetailResponse,
    summary="Отмена заказа (US-17)",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        409: {"model": ErrorResponse, "description": "Заказ нельзя отменить"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def cancel_order(id: UUID):
    return {"data": ORDER.model_dump(mode="json")}


@router.post(
    "/{id}/pay",
    status_code=200,
    response_model=OrderDetailResponse,
    summary="Оплата заказа (US-14, US-16)",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        402: {
            "model": ErrorResponse,
            "description": "Платёж отклонён шлюзом — можно повторить (US-16)",
        },
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        409: {
            "model": ErrorResponse,
            "description": "Заказ уже оплачен, отменён или срок удержания истёк",
        },
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def pay_order(id: UUID):
    return {"data": ORDER.model_dump(mode="json")}
