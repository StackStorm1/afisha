from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки читаются только из переменных окружения.

    Файл .env лежит в корне репозитория и принадлежит docker-compose: он
    подставляет из него значения и передаёт их сервисам. Наполнить окружение —
    задача того, кто запускает приложение (compose, systemd, `uv run --env-file`),
    а не самого приложения. Благодаря этому в контейнере и на хост-машине
    конфигурация грузится одним и тем же путём, без расхождений.
    """

    # DSN целиком. Собирать его здесь из POSTGRES_* нельзя: POSTGRES_PORT задаёт
    # порт публикации на хост, а внутри docker-сети порт всегда 5432.
    database_url: str

    # JWT
    secret_key: str
    jwt_algorithm: str
    access_token_expire_minutes: int

    booking_hold_minutes: int = 15

    backend_cors_origins: str = "http://localhost"
    environment: str = "local"
    log_level: str = "info"
    debug: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
