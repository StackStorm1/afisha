from fastapi import APIRouter

from app.stubs.fixtures import CITY

router = APIRouter(prefix="/cities", tags=["cities"])


@router.get("")
async def list_cities():
    return {"data": [CITY.model_dump(mode="json")]}
