# Схема базы данных

## ER-диаграмма

```mermaid
erDiagram
    USERS {
        uuid        id          PK
        varchar(255) email      UK "NOT NULL"
        varchar(255) password_hash "NOT NULL"
        varchar(50)  role       "NOT NULL DEFAULT 'visitor'"
        timestamptz  created_at "NOT NULL DEFAULT now()"
    }

    CATEGORIES {
        int         id          PK
        varchar(100) name       UK "NOT NULL"
        varchar(100) slug       UK "NOT NULL"
    }

    VENUES {
        uuid        id          PK
        varchar(100) city        "NOT NULL"
        varchar(255) name       "NOT NULL"
        varchar(500) address    "NOT NULL"
        int         capacity    "NOT NULL CHECK > 0"
    }

    EVENTS {
        uuid        id          PK
        varchar(255) title      "NOT NULL"
        text        description
        int         category_id FK "NOT NULL"
        varchar(10)  age_rating  "e.g. 0+, 6+, 12+, 16+, 18+"
        varchar(500) poster_url
        timestamptz  created_at "NOT NULL DEFAULT now()"
        timestamptz  updated_at "NOT NULL DEFAULT now()"
    }

    SESSIONS {
        uuid        id          PK
        uuid        event_id    FK "NOT NULL"
        uuid        venue_id    FK "NOT NULL"
        varchar(100) city       "NOT NULL"
        timestamptz  starts_at  "NOT NULL"
        numeric(10_2) price     "NOT NULL CHECK >= 0"
        int         total_seats "NOT NULL CHECK > 0"
        int         seats_left  "NOT NULL CHECK >= 0"
        varchar(20)  status     "NOT NULL DEFAULT 'active'"
    }

    ORDERS {
        uuid        id          PK
        uuid        user_id     FK "NOT NULL"
        uuid        session_id  FK "NOT NULL"
        int         quantity    "NOT NULL CHECK > 0"
        numeric(10_2) total_price "NOT NULL CHECK >= 0"
        varchar(20)  status     "NOT NULL DEFAULT 'pending'"
        timestamptz  created_at "NOT NULL DEFAULT now()"
        timestamptz  updated_at "NOT NULL DEFAULT now()"
    }

    FAVORITES {
        uuid        id          PK
        uuid        user_id     FK "NOT NULL"
        uuid        event_id    FK "NOT NULL"
        timestamptz  created_at "NOT NULL DEFAULT now()"
    }

    USERS        ||--o{ ORDERS    : "размещает"
    USERS        ||--o{ FAVORITES : "сохраняет"
    EVENTS       ||--o{ SESSIONS  : "имеет"
    EVENTS       ||--o{ FAVORITES : "добавляется в"
    EVENTS       }o--|| CATEGORIES : "принадлежит"
    SESSIONS     ||--o{ ORDERS    : "включается в"
    SESSIONS     }o--|| VENUES    : "проходит в"
```

---

## Сущности

### USERS

| Поле          | Тип          | Ограничения                                              |
|---------------|--------------|----------------------------------------------------------|
| id            | uuid         | PK, DEFAULT gen_random_uuid()                            |
| email         | varchar(255) | NOT NULL, UNIQUE                                         |
| password_hash | varchar(255) | NOT NULL                                                 |
| role          | varchar(50)  | NOT NULL, DEFAULT 'visitor', CHECK IN ('visitor','admin') |
| created_at    | timestamptz  | NOT NULL, DEFAULT now()                                  |

### CATEGORIES

| Поле | Тип          | Ограничения      |
|------|--------------|------------------|
| id   | int          | PK, SERIAL       |
| name | varchar(100) | NOT NULL, UNIQUE |
| slug | varchar(100) | NOT NULL, UNIQUE |

### VENUES

| Поле     | Тип          | Ограничения                    |
|----------|--------------|--------------------------------|
| id       | uuid         | PK, DEFAULT gen_random_uuid()  |
| city     | varchar(100) | NOT NULL                       |
| name     | varchar(255) | NOT NULL                       |
| address  | varchar(500) | NOT NULL                       |
| capacity | int          | NOT NULL, CHECK (capacity > 0) |

### EVENTS

| Поле        | Тип          | Ограничения                                          |
|-------------|--------------|------------------------------------------------------|
| id          | uuid         | PK, DEFAULT gen_random_uuid()                        |
| title       | varchar(255) | NOT NULL                                             |
| description | text         |                                                      |
| category_id | int          | FK → categories.id, NOT NULL                         |
| age_rating  | varchar(10)  | CHECK IN ('0+','6+','12+','16+','18+')               |
| poster_url  | varchar(500) |                                                      |
| created_at  | timestamptz  | NOT NULL, DEFAULT now()                              |
| updated_at  | timestamptz  | NOT NULL, DEFAULT now()                              |

### SESSIONS

| Поле        | Тип           | Ограничения                                                         |
|-------------|---------------|---------------------------------------------------------------------|
| id          | uuid          | PK, DEFAULT gen_random_uuid()                                       |
| event_id    | uuid          | FK → events.id, NOT NULL                                            |
| venue_id    | uuid          | FK → venues.id, NOT NULL                                            |
| city        | varchar(100)  | NOT NULL                                                            |
| starts_at   | timestamptz   | NOT NULL                                                            |
| price       | numeric(10,2) | NOT NULL, CHECK (price >= 0)                                        |
| total_seats | int           | NOT NULL, CHECK (total_seats > 0)                                   |
| seats_left  | int           | NOT NULL, CHECK (seats_left >= 0)                                   |
| status      | varchar(20)   | NOT NULL, DEFAULT 'active', CHECK IN ('active','cancelled','completed') |

> `city` денормализован из `venues.city` для эффективной фильтрации каталога без JOIN.

### ORDERS

| Поле        | Тип           | Ограничения                                                    |
|-------------|---------------|----------------------------------------------------------------|
| id          | uuid          | PK, DEFAULT gen_random_uuid()                                  |
| user_id     | uuid          | FK → users.id, NOT NULL                                        |
| session_id  | uuid          | FK → sessions.id, NOT NULL                                     |
| quantity    | int           | NOT NULL, CHECK (quantity > 0)                                 |
| total_price | numeric(10,2) | NOT NULL, CHECK (total_price >= 0)                             |
| status      | varchar(20)   | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','paid','cancelled','failed') |
| created_at  | timestamptz   | NOT NULL, DEFAULT now()                                        |
| updated_at  | timestamptz   | NOT NULL, DEFAULT now()                                        |

### FAVORITES

| Поле       | Тип         | Ограничения                             |
|------------|-------------|-----------------------------------------|
| id         | uuid        | PK, DEFAULT gen_random_uuid()           |
| user_id    | uuid        | FK → users.id, NOT NULL, ON DELETE CASCADE |
| event_id   | uuid        | FK → events.id, NOT NULL, ON DELETE CASCADE |
| created_at | timestamptz | NOT NULL, DEFAULT now()                 |

**Уникальность:** UNIQUE (user_id, event_id)

---

## Индексы

| Индекс | Таблица | Выражение | Обоснование |
|--------|---------|-----------|-------------|
| `idx_sessions_city_starts_at` | sessions | `(city, starts_at)` | Главный запрос каталога: события в городе, отсортированные по дате (US-01, US-03) |
| `idx_sessions_event_id` | sessions | `(event_id)` | Загрузка списка сеансов на странице события (US-05) |
| `idx_sessions_status_starts_at` | sessions | `(status, starts_at)` | Фильтрация активных сеансов при построении каталога |
| `idx_events_fts` | events | `USING GIN (to_tsvector('russian', title \|\| ' ' \|\| coalesce(description, '')))` | Полнотекстовый поиск по названию и описанию (US-02) |
| `idx_events_category_id` | events | `(category_id)` | Фильтрация по категории (US-03) |
| `idx_orders_user_id` | orders | `(user_id, created_at DESC)` | Список заказов пользователя в личном кабинете (US-14) |
| `idx_orders_session_id` | orders | `(session_id)` | Отображение заказов при отмене сеанса (US-20) |
| `idx_favorites_user_id` | favorites | `(user_id)` | Список избранного пользователя (US-16) |
| `idx_venues_city` | venues | `(city)` | Фильтрация площадок по городу (US-07) |

### Конкурентное обновление seats_left

При покупке билетов используется оптимистичная блокировка:

```sql
UPDATE sessions
SET seats_left = seats_left - :qty
WHERE id = :session_id
  AND seats_left >= :qty;
-- Если 0 строк затронуто — показываем US-13 "нет мест"
```
