from datetime import UTC, datetime, timedelta

import jwt
import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from tests.factories import make_user


@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "secret123"},
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["token"]
    assert data["expires_in"] > 0
    assert data["user"]["email"] == "new@example.com"
    assert data["user"]["role"] == "visitor"
    assert "password_hash" not in data["user"]


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, session):
    await make_user(session, email="dup@example.com")
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "dup@example.com", "password": "secret123"},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_ALREADY_TAKEN"


@pytest.mark.asyncio
async def test_register_duplicate_email_case_insensitive(client: AsyncClient, session):
    await make_user(session, email="user@example.com")
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "USER@example.com", "password": "secret123"},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_ALREADY_TAKEN"


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "password": "short"},
    )
    assert response.status_code == 422
    details = response.json()["details"]
    assert any(d["field"] == "password" for d in details)


@pytest.mark.asyncio
async def test_login(client: AsyncClient, session):
    await make_user(
        session, email="login@example.com", password_hash=hash_password("secret123")
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "secret123"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["token"]


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, session):
    await make_user(
        session, email="wrong@example.com", password_hash=hash_password("correct")
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrong@example.com", "password": "incorrect"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_me(client: AsyncClient, session):
    user = await make_user(session, email="me@example.com")
    token, _ = create_access_token(user.id)
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["email"] == "me@example.com"


@pytest.mark.asyncio
async def test_me_no_token(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_me_expired_token(client: AsyncClient, session):
    user = await make_user(session, email="expired@example.com")
    settings = get_settings()
    payload = {
        "sub": str(user.id),
        "iat": datetime.now(UTC),
        "exp": datetime.now(UTC) - timedelta(seconds=1),
    }
    expired_token = jwt.encode(
        payload, settings.secret_key, algorithm=settings.jwt_algorithm
    )
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "TOKEN_EXPIRED"
