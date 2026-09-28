from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ErrorCode
from app.core.security import decode_access_token
from app.db.session import get_async_db
from app.models.users import User

DbSession = Annotated[AsyncSession, Depends(get_async_db)]

_bearer = HTTPBearer(auto_error=False)

Token = Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]


async def _get_user_from_token(token: Token, db: DbSession) -> User | None:
    if token is None:
        return None
    try:
        user_id: UUID = decode_access_token(token.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": ErrorCode.TOKEN_EXPIRED, "message": "Токен истёк"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": ErrorCode.UNAUTHORIZED,
                "message": "Недействительный токен",
            },
        )
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def current_user(token: Token, db: DbSession) -> User:
    user = await _get_user_from_token(token, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": ErrorCode.UNAUTHORIZED, "message": "Требуется авторизация"},
        )
    return user


async def optional_current_user(token: Token, db: DbSession) -> User | None:
    return await _get_user_from_token(token, db)


async def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
    from app.enums import UserRole

    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": ErrorCode.FORBIDDEN, "message": "Недостаточно прав"},
        )
    return user
