from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class CategoryCode(StrEnum):
    CONCERT = 'concert'
    THEATRE = 'theatre'
    STANDUP = 'standup'
    FESTIVAL = 'festival'

class Category(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int = Field(..., examples=[1])
    code: CategoryCode = Field(..., 
                    description='Стабильный идентификатор категории для логики приложения. В БД хранится в верхнем регистре (`THEATRE`), в API отдаётся в нижнем.',
                    examples=['theatre']
                               )
    name: str = Field(..., max_length=100, examples=['Театр'])
    slug: str = Field(..., max_length=100, examples=['theatre'])