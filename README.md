# Backend — быстрый старт

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

## Разработка без Docker

Нужен [uv](https://docs.astral.sh/uv/) — им поставлены все зависимости backend.

Postgres всё равно нужен в контейнере:

```bash
docker compose up -d db
```

Установка зависимостей и запуск сервера с автоперезагрузкой:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

## Тесты и линтер

Выполнять из `backend/`:

```bash
uv run pytest
uv run ruff check .
```
