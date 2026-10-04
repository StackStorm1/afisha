from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ErrorCode
from app.core.security import create_access_token, hash_password, verify_password
from app.models.users import User
from app.schemas.auth import AuthResponseData, UserProfile


async def register(db: AsyncSession, email: str, password: str) -> AuthResponseData:
    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": ErrorCode.EMAIL_ALREADY_TAKEN,
                "message": "Email уже занят",
            },
        )
    token, expires_in = create_access_token(user.id)
    return AuthResponseData(
        token=token,
        expires_in=expires_in,
        user=UserProfile(
            id=user.id,
            email=user.email,
            role=user.role.lower(),
            created_at=user.created_at,
        ),
    )


async def login(db: AsyncSession, email: str, password: str) -> AuthResponseData:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": ErrorCode.INVALID_CREDENTIALS,
                "message": "Неверный email или пароль",
            },
        )
    token, expires_in = create_access_token(user.id)
    return AuthResponseData(
        token=token,
        expires_in=expires_in,
        user=UserProfile(
            id=user.id,
            email=user.email,
            role=user.role.lower(),
            created_at=user.created_at,
        ),
    )
