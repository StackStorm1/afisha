# Версии закреплены до патча — сборка воспроизводима.
# 24 — действующий Active LTS, та же мажорная версия, что и в CI.
FROM node:24.21.0-alpine AS builder

WORKDIR /app

# Зависимости ставятся до копирования исходников: правка в src/ не сбрасывает
# кэш этого слоя. npm ci, а не install: ставит ровно то, что в lock-файле.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# 1.30 — stable-ветка nginx. Вариант unprivileged работает от uid 101:
# root в рантайме не нужен, как и в образе backend.
FROM nginxinc/nginx-unprivileged:1.30.5-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf

# В финальный образ едет только результат сборки. Node и node_modules
# остаются на стадии builder: ~50 МБ против ~400 МБ.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

# wget из busybox — curl в alpine-образе нет. Без healthcheck
# docker compose up --wait не сможет дождаться фронтенда.
# Адрес именно 127.0.0.1: localhost внутри контейнера резолвится в ::1, nginx
# слушает только IPv4, а busybox-wget на IPv4 не переключается.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "--quiet", "--spider", "http://127.0.0.1:8080/"]
