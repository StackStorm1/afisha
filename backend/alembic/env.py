import asyncio
from logging.config import fileConfig

from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from alembic import context
from app.core.config import get_settings
from app.models import Base

config = context.config

# Настройка логирования по секциям [loggers]/[handlers] из alembic.ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Base импортируется из app.models, а не из app.db.base: получить его оттуда
# невозможно, не выполнив импорт всех моделей, а значит metadata гарантированно
# полная. С пустой metadata autogenerate молча выдал бы миграцию, удаляющую
# все таблицы.
target_metadata = Base.metadata


def get_url() -> str:
    """DSN берётся из настроек приложения, а не из alembic.ini.

    Окружение — единственный источник правды. Запись
    URL обратно в config через set_main_option потребовала бы экранировать "%"
    в пароле, потому что configparser интерполирует значения при чтении.
    """
    return get_settings().database_url


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Прогнать миграции через асинхронное соединение.

    Сам Alembic синхронный, поэтому работа выполняется в run_sync поверх
    asyncpg-соединения. NullPool: процесс разовый, держать пул незачем.
    """
    connectable = create_async_engine(get_url(), poolclass=NullPool)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Применить миграции к живой базе."""
    asyncio.run(run_async_migrations())


run_migrations_online()
