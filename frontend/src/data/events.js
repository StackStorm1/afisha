import { uuid } from '../lib/uuid.js';
import { toMoney } from '../lib/money.js';
import { createSeededRandom, pick, randomInt } from '../lib/seededRandom.js';
import { CATEGORIES } from './categories.js';
import { VENUES } from './venues.js';
import { TITLES_BY_CATEGORY, DESCRIPTIONS } from './eventTitles.js';

const AGE_RATINGS = ['0+', '6+', '12+', '16+', '18+'];
const EVENTS_PER_CATEGORY = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

// Сид фиксирован — каталог не должен перетасовываться между перезагрузками
// страницы или прогонами тестов.
const random = createSeededRandom(20260918);

function buildSession({ eventId, venue, startsAt, status, seatsAvailable }) {
  const seatsTotal = venue.rows_count * venue.seats_per_row;
  return {
    id: uuid(random),
    event_id: eventId,
    venue,
    city: venue.city,
    starts_at: startsAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    price: toMoney(randomInt(random, 8, 40) * 100),
    total_seats: seatsTotal,
    seats_left: Math.max(0, Math.min(seatsTotal, seatsAvailable)),
    status,
  };
}

function buildSessionsForEvent(eventId) {
  const sessionsCount = randomInt(random, 2, 6);
  const venue = pick(random, VENUES);
  const seatsTotal = venue.rows_count * venue.seats_per_row;

  // ~15% событий полностью распроданы — честная проверка бейджа «Продано»
  // (requirements.md, US-01: минимальная ДОСТУПНАЯ цена, не историческая).
  const soldOutEvent = random() < 0.15;

  const sessions = [];
  for (let i = 0; i < sessionsCount; i += 1) {
    const startsAt = new Date(Date.now() + randomInt(random, 0, 45) * DAY_MS);
    startsAt.setUTCHours(randomInt(random, 11, 22), pick(random, [0, 30]), 0, 0);

    // Один из сеансов события — отменённый, если событие не полностью
    // распродано (отменённый сеанс должен быть виден и задизейблен, не скрыт).
    const isCancelled = !soldOutEvent && i === 0 && random() < 0.1;

    sessions.push(
      buildSession({
        eventId,
        venue,
        startsAt,
        status: isCancelled ? 'cancelled' : 'active',
        seatsAvailable: soldOutEvent ? 0 : randomInt(random, 0, seatsTotal),
      })
    );
  }

  return sessions.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

function summarize(event, sessions) {
  const activeSessions = sessions.filter((s) => s.status === 'active');
  if (activeSessions.length === 0) return null;

  const nearest = activeSessions.reduce((min, s) =>
    s.starts_at < min.starts_at ? s : min
  );
  const cheapest = activeSessions.reduce((min, s) =>
    Number(s.price) < Number(min.price) ? s : min
  );

  return {
    ...event,
    nearest_session_at: nearest.starts_at,
    min_price: cheapest.price,
    sessions_count: activeSessions.length,
  };
}

function buildCatalog() {
  const events = [];
  const sessionsByEvent = new Map();
  const eventById = new Map();
  const eventIdBySessionId = new Map();
  const sessionById = new Map();

  for (const category of CATEGORIES) {
    const titles = TITLES_BY_CATEGORY[category.code];
    for (let i = 0; i < EVENTS_PER_CATEGORY; i += 1) {
      const id = uuid(random);
      const repeat = Math.floor(i / titles.length);
      const title = titles[i % titles.length] + (repeat > 0 ? ` ${repeat + 1}` : '');
      const event = {
        id,
        title,
        description: pick(random, DESCRIPTIONS),
        category,
        age_rating: pick(random, AGE_RATINGS),
        poster_url: null,
        // duration_minutes/has_intermission — нет в openapi.yaml (EventBase),
        // только для карточки страницы события: длительность там нужна,
        // а контракт её пока не описывает.
        duration_minutes: randomInt(random, 50, 170),
        has_intermission: random() < 0.4,
        created_at: new Date(Date.now() - randomInt(random, 30, 200) * DAY_MS)
          .toISOString()
          .replace(/\.\d{3}Z$/, 'Z'),
        updated_at: new Date(Date.now() - randomInt(random, 0, 29) * DAY_MS)
          .toISOString()
          .replace(/\.\d{3}Z$/, 'Z'),
      };

      const sessions = buildSessionsForEvent(id);
      sessionsByEvent.set(id, sessions);
      for (const session of sessions) {
        eventIdBySessionId.set(session.id, id);
        sessionById.set(session.id, session);
      }

      const summary = summarize(event, sessions);
      if (summary) {
        events.push(summary);
        eventById.set(id, summary);
      }
    }
  }

  return { events, sessionsByEvent, eventById, eventIdBySessionId, sessionById };
}

const {
  events: ALL_EVENTS,
  sessionsByEvent: SESSIONS_BY_EVENT,
  eventById: EVENT_BY_ID,
  eventIdBySessionId: EVENT_ID_BY_SESSION_ID,
  sessionById: SESSION_BY_ID,
} = buildCatalog();

function hasSessionInRange(eventId, date_from, date_to) {
  if (!date_from && !date_to) return true;
  const from = date_from ? `${date_from}T00:00:00Z` : null;
  const to = date_to ? `${date_to}T23:59:59Z` : null;
  return (SESSIONS_BY_EVENT.get(eventId) ?? []).some((session) => {
    if (session.status !== 'active') return false;
    if (from && session.starts_at < from) return false;
    if (to && session.starts_at > to) return false;
    return true;
  });
}

function matchesFilters(event, { category, date_from, date_to, q } = {}) {
  if (category && event.category.slug !== category) return false;
  if (!hasSessionInRange(event.id, date_from, date_to)) return false;
  if (q) {
    // US-02/openapi.yaml: полнотекстовый поиск по названию И описанию.
    const needle = q.trim().toLowerCase();
    const haystack = `${event.title} ${event.description ?? ''}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

const SORTERS = {
  date_asc: (a, b) => a.nearest_session_at.localeCompare(b.nearest_session_at),
  date_desc: (a, b) => b.nearest_session_at.localeCompare(a.nearest_session_at),
  price_asc: (a, b) => Number(a.min_price) - Number(b.min_price),
  price_desc: (a, b) => Number(b.min_price) - Number(a.min_price),
};

// Мок GET /events — форма ответа: EventListResponse.
export function listEvents({
  category,
  date_from,
  date_to,
  q,
  sort = 'date_asc',
  page = 1,
  per_page = 20,
} = {}) {
  const filtered = ALL_EVENTS.filter((event) =>
    matchesFilters(event, { category, date_from, date_to, q })
  ).sort(SORTERS[sort] ?? SORTERS.date_asc);

  const total = filtered.length;
  const total_pages = Math.max(1, Math.ceil(total / per_page));
  const start = (page - 1) * per_page;
  const data = filtered.slice(start, start + per_page);

  return { data, pagination: { page, per_page, total, total_pages } };
}

// Мок GET /events/{id} — форма ответа: { data: EventDetail }. EventDetail в
// контракте — тот же набор полей, что EventSummary (allOf без добавлений).
export function getEvent(id) {
  return EVENT_BY_ID.get(id) ?? null;
}

// Мок GET /events/{id}/sessions — форма ответа: { data: Session[] }.
export function listEventSessions(eventId) {
  return SESSIONS_BY_EVENT.get(eventId) ?? [];
}

// Мок GET /sessions/{id} — форма ответа: { data: Session }.
export function getSession(sessionId) {
  return SESSION_BY_ID.get(sessionId) ?? null;
}

export function getEventBySessionId(sessionId) {
  const eventId = EVENT_ID_BY_SESSION_ID.get(sessionId);
  return eventId ? getEvent(eventId) : null;
}
