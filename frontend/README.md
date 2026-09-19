# Afisha — frontend

React 18 + Vite, `react-router-dom`, `zustand`, `@tanstack/react-query`, CSS
Modules. Требования, схема базы и контракт API — в `docs/` в корне
репозитория: `requirements.md`, `db-schema.md`, `api/openapi.yaml`.

## Запуск

```bash
npm install
npm run dev
```

Поднимается на `http://localhost:5173`.

Порт 5173 принадлежит только dev-серверу. Контейнер из `docker compose`
публикуется на 8080, поэтому запускать их одновременно можно.

## Docker

Образ собирает статику и отдаёт её через nginx; Node в рантайме нет. Сборка
идёт из `docker compose up --build` в корне репозитория, отдельная команда не
нужна; открывается на <http://localhost:8080>. Маршруты вроде
`/events/:eventId` существуют только в браузере, поэтому nginx подменяет
ненайденные пути на `index.html` (`frontend/nginx.conf`).

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер с HMR |
| `npm run build` | Продакшен-сборка в `dist/` |
| `npm run preview` | Локальный просмотр собранного `dist/` |
| `npm run lint` | ESLint, `--max-warnings 0` |
| `npm run format` | Prettier, правит на месте |
| `npm run format:check` | Prettier, только проверка |
| `npm test` | Vitest |

Бэкенд пока не отвечает ни на один бизнес-эндпоинт (только `/health`) —
данные мокаются в `src/data/`, форма моков повторяет `docs/api/openapi.yaml`.
`VITE_API_BASE_URL` (см. `.env.local.example`) понадобится при подключении
реального бэкенда.
