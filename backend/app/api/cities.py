from fastapi import APIRouter

from app.schemas.cities import CityListResponse
from app.schemas.errors import ErrorResponse
from app.stubs.fixtures import CITY

router = APIRouter(prefix="/cities", tags=["cities"])


@router.get(
    "",
    status_code=200,
    response_model=CityListResponse,
    summary="Список городов",
    responses={
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def list_cities():
    return {"data": [CITY.model_dump(mode="json")]}
