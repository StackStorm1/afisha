# Быстрый старт

## Запуск через Docker

```bash
cp .env.example .env
docker compose up --build
```

Проверить, что backend поднялся:

```bash
curl http://localhost:8000/health
```

Должно вернуть `{"status":"ok"}`.

Фронтенд поднимается той же командой и открывается на
<http://localhost:8080>. В образе лежит только собранная статика за nginx —
для разработки с автоперезагрузкой запускайте `npm run dev`, он занимает
отдельный порт 5173 и стеку не мешает. См. `frontend/README.md`.

## Разработка backend без Docker

Нужен [uv](https://docs.astral.sh/uv/) — им поставлены все зависимости backend.

Postgres всё равно нужен в контейнере:

```bash
docker compose up -d db
```

Установка зависимостей и запуск сервера с автоперезагрузкой:

```bash
cd backend
uv sync
uv run --env-file ../.env uvicorn app.main:app --reload
```

`--env-file` обязателен. Приложение читает только переменные окружения и не
открывает `.env` само: в контейнере окружение наполняет docker-compose, на
хост-машине — эта команда. Путь загрузки настроек один и тот же везде, поэтому
конфигурация в Docker и локально не может незаметно разойтись.

Чтобы не повторять флаг, его можно задать один раз на сессию:

```bash
export UV_ENV_FILE=../.env
```

## Тесты и линтер

Выполнять из `backend/`:

```bash
uv run --env-file ../.env pytest
uv run ruff check .
uv run ruff format --check .
```

Тестам нужен поднятый Postgres (`docker compose up -d db`) — проверка `/health`
ходит в базу. Линтеру и форматтеру окружение не нужно.
