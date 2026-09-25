from pydantic import BaseModel, ConfigDict, Field


class City(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., examples=[1])
    name: str = Field(..., max_length=100, examples=["Москва"])
    slug: str = Field(..., max_length=100, examples=["moskva"])


class CityListResponse(BaseModel):
    data: list[City]
