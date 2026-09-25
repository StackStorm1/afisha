from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.core.errors import ErrorCode
from app.enums import OrderStatus
from app.schemas.errors import ErrorResponse
from app.schemas.orders import CreateOrderRequest, OrderDetailResponse, OrderListResponse
from app.stubs.fixtures import ORDER, PAGINATION, TAKEN_SEAT_ID

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", 
            status_code=201,
            response_model=OrderDetailResponse,
            summary="Создание брони — выбор мест (US-11)",
            responses={
                401: {"model": ErrorResponse, "description": "Токен отсутствует или недействителен"},
                404: {"model": ErrorResponse, "description": "Ресурс не найден"},
                409: {"model": ErrorResponse, "description": "Сеанс неактивен или место уже занято"},
                422: {"model": ErrorResponse, "description": "Нарушены правила валидации полей"},
                500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
            } 
            )
async def create_order(body: CreateOrderRequest):
    if TAKEN_SEAT_ID in body.seat_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": ErrorCode.SEAT_ALREADY_TAKEN,
                "message": "Одно или несколько выбранных мест уже заняты",
                "details": [
                    {
                        "seat_id": str(TAKEN_SEAT_ID),
                        "message": "Ряд 1, место 3 уже занято",
                    }
                ],
            },
        )
    return {"data": ORDER.model_dump(mode="json")}


@router.get(
    "",
    status_code=200,
    response_model=OrderListResponse,
    summary="Мои брони (US-15)",
    responses={
        401: {"model": ErrorResponse, "description": "Токен отсутствует или недействителен"},
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
        401: {"model": ErrorResponse, "description": "Токен отсутствует или недействителен"},
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    }
    )
async def get_order(id: UUID):
    return {"data": ORDER.model_dump(mode="json")}


@router.delete(
    "/{id}",
    status_code=200,
    response_model=OrderDetailResponse,
    summary="Отмена заказа (US-17)",
    responses={
        401: {"model": ErrorResponse, "description": "Токен отсутствует или недействителен"},
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
        401: {"model": ErrorResponse, "description": "Токен отсутствует или недействителен"},
        402: {"model": ErrorResponse, "description": "Платёж отклонён шлюзом — можно повторить (US-16)"},
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        409: {"model": ErrorResponse, "description": "Заказ уже оплачен, отменён или срок удержания истёк"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
    )
async def pay_order(id: UUID):
    return {"data": ORDER.model_dump(mode="json")}
