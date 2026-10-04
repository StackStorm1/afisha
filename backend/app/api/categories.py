from fastapi import APIRouter

from app.schemas.categories import CategoryListResponse
from app.schemas.errors import ErrorResponse
from app.stubs.fixtures import CATEGORY

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get(
    "",
    status_code=200,
    response_model=CategoryListResponse,
    summary="Список категорий",
    responses={
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def list_categories():
    return {"data": [CATEGORY.model_dump(mode="json")]}
