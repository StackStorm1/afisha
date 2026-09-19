from pydantic import BaseModel, Field, EmailStr, AwareDatetime
from uuid import UUID
from enum import StrEnum

class UserClass(StrEnum):
    VISITOR = 'visitor'
    ADMIN = 'admin'

class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., max_length=255, examples=['user@example.com'])
    password: str = Field(..., min_length=8, max_length=255, examples=['s3cr3tPass'])
    
class LoginRequest(BaseModel):
    email: EmailStr = Field(..., examples=['user@example.com'])
    password: str = Field(..., examples=['s3cr3tPass'])
    
class UserProfile(BaseModel):
    id: UUID
    email: EmailStr = Field(..., examples=['user@example.com'])
    role: UserClass
    created_at: AwareDatetime
    
class AuthResponseData(BaseModel):
    token: str = Field(..., description='JWT Bearer-токен', examples=['eyJhbGciOiJIUzI1NiJ9...'])
    expires_in: int = Field(..., description=(
        "Срок жизни токена в секундах. В MVP — 7 суток. Refresh-токена нет: "
        "по истечении срока endpoints отвечают 401 `TOKEN_EXPIRED` "
        "и требуется повторный вход."
    ), examples=[604800])
    user: UserProfile
    
class AuthResponse(BaseModel):
    data: AuthResponseData