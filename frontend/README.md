# Afisha — frontend

React 18 + Vite, `react-router-dom`, `zustand`, `@tanstack/react-query`, CSS
Modules. Общая архитектура, макеты и бэклог — в `afisha-frontend-docs/`
(README.md там указывает, что читать дальше) и в `docs/` в корне репозитория
(`requirements.md`, `db-schema.md`, `api/openapi.yaml`).

## Запуск

```bash
npm install
npm run dev
```

Поднимается на `http://localhost:5173`.

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
