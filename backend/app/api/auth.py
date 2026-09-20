from fastapi import APIRouter

from app.schemas.auth import LoginRequest, RegisterRequest
from app.stubs.fixtures import AUTH_RESPONSE, USER

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    return AUTH_RESPONSE.model_dump(mode="json")


@router.post("/login")
async def login(body: LoginRequest):
    return AUTH_RESPONSE.model_dump(mode="json")


@router.get("/me")
async def get_me():
    return {"data": USER.model_dump(mode="json")}
