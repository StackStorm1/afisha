from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.schemas.orders import CreateOrderRequest
from app.stubs.fixtures import ORDER, PAGINATION, TAKEN_SEAT_ID

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", status_code=201)
async def create_order(body: CreateOrderRequest):
    if TAKEN_SEAT_ID in body.seat_ids:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SEAT_ALREADY_TAKEN",
                "message": "Одно или несколько выбранных мест уже заняты",
                "details": [
                    {"seat_id": str(TAKEN_SEAT_ID), "message": "Ряд 1, место 3 уже занято"}
                ],
            },
        )
    return {"data": ORDER.model_dump(mode="json")}


@router.get("")
async def list_orders():
    return {
        "data": [ORDER.model_dump(mode="json")],
        "pagination": PAGINATION.model_dump(mode="json"),
    }


@router.get("/{id}")
async def get_order(id: UUID):
    return {"data": ORDER.model_dump(mode="json")}


@router.delete("/{id}")
async def cancel_order(id: UUID):
    return {"data": ORDER.model_dump(mode="json")}


@router.post("/{id}/pay")
async def pay_order(id: UUID):
    return {"data": ORDER.model_dump(mode="json")}
