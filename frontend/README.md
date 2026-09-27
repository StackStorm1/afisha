# Afisha — frontend

React 18 + Vite, `react-router-dom`, `zustand`, CSS Modules. Данные мокаются в
`src/data/` по контракту `docs/api/openapi.yaml`.

## Запуск

```bash
npm install
npm run dev
```

Dev-сервер: <http://localhost:5173>.

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер с HMR |
| `npm run build` | Продакшен-сборка в `dist/` |
| `npm run preview` | Просмотр собранного `dist/` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Vitest |
