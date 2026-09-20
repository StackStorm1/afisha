from fastapi import APIRouter

from app.stubs.fixtures import CATEGORY

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("")
async def list_categories():
    return {"data": [CATEGORY.model_dump(mode="json")]}
