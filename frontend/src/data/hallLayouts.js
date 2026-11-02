import { uuid } from '../lib/uuid.js';
import { toMoney } from '../lib/money.js';
import { createSeededRandom, hashSeed } from '../lib/seededRandom.js';
import { generateSeats } from '../lib/hallLayout.js';
import { layoutIssues } from '../lib/layoutIssues.js';
import { getSession, listEvents, listEventSessions } from './events.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, seedLayouts } from './hallLayoutSeeds.js';

export { CANVAS_HEIGHT, CANVAS_WIDTH };

// Мок админских ручек сегментной схемы зала. У площадки несколько
// конфигураций зала (театральная, концертная с танцполом…), сеанс продаётся
// по одной из них, цены сеанс задаёт на каждую ценовую зону.
//
// Сидячий сектор хранится параметрами генератора (generator), места из них
// строит lib/hallLayout.js. Наружу конфигурация отдаётся вместе с местами.
// Стоячая зона — только вместимость.

// Стартовые цены зон для сеансов из каталога. Цена сеанса в каталоге —
// «от»: столько стоит самая дешёвая зона (последняя по sort_order), зоны
// ближе к сцене дороже. Дальше админ правит цены сам.
const SEED_PRICE_FACTORS = [1, 1.6, 2.2, 3];

export class HallLayoutError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// id новых ревизий. Сид другой, чем у сидов: с тем же сидом первая
// ревизия получила бы id первой сидовой конфигурации.
const random = createSeededRandom(20261008);
const newId = () => uuid(random);

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const layoutsById = new Map();
// Порядок конфигураций площадки; архивные сюда не входят. Первая —
// конфигурация по умолчанию для сеансов, которым её явно не назначили.
const layoutIdsByVenue = new Map();
// Явные привязки сеанса: { layout_id, prices }. Сеанс без записи живёт на
// конфигурации по умолчанию со стартовыми ценами.
const sessionHalls = new Map();

function seed() {
  for (const [venueId, layouts] of seedLayouts()) {
    for (const layout of layouts) layoutsById.set(layout.id, layout);
    layoutIdsByVenue.set(
      venueId,
      layouts.map((layout) => layout.id)
    );
  }
}

seed();

function clone(value) {
  return structuredClone(value);
}

// Места сидячих секторов. id мест детерминированы по id конфигурации и
// сектора: повторный запрос отдаёт те же id.
function withSeats(layout) {
  const result = clone(layout);
  for (const section of result.sections) {
    if (section.kind !== 'seated') continue;
    const seatRandom = createSeededRandom(hashSeed(`${layout.id}:${section.id}`));
    section.seats = generateSeats(section).map((seat) => ({
      id: uuid(seatRandom),
      ...seat,
    }));
  }
  return result;
}

function requireLayout(layoutId) {
  const layout = layoutsById.get(layoutId);
  if (!layout) throw new HallLayoutError('NOT_FOUND', 'Конфигурация зала не найдена');
  return layout;
}

function requireSession(sessionId) {
  const session = getSession(sessionId);
  if (!session) throw new HallLayoutError('NOT_FOUND', 'Сеанс не найден');
  return session;
}

function defaultLayoutId(venueId) {
  return layoutIdsByVenue.get(venueId)?.[0] ?? null;
}

function seedPrices(layout, session) {
  return [...layout.price_zones]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((z, i, zones) => {
      const fromCheapest = zones.length - 1 - i;
      const factor =
        SEED_PRICE_FACTORS[Math.min(fromCheapest, SEED_PRICE_FACTORS.length - 1)];
      // Округление до 100 ₽ — так выглядят цены живых афиш.
      return {
        price_zone_id: z.id,
        price: toMoney(Math.round((Number(session.price) * factor) / 100) * 100),
      };
    });
}

function resolveSessionHall(session) {
  const explicit = sessionHalls.get(session.id);
  if (explicit) return explicit;
  const layoutId = defaultLayoutId(session.venue.id);
  return { layout_id: layoutId, prices: seedPrices(layoutsById.get(layoutId), session) };
}

function soldCount(session) {
  return Math.max(0, session.total_seats - session.seats_left);
}

let allSessionsCache = null;

function allSessions() {
  if (!allSessionsCache) {
    allSessionsCache = listEvents({ per_page: 500 }).data.flatMap((event) =>
      listEventSessions(event.id)
    );
  }
  return allSessionsCache;
}

function sessionsOnLayout(layoutId) {
  return allSessions().filter(
    (session) => resolveSessionHall(session).layout_id === layoutId
  );
}

function summarize(layout) {
  return {
    id: layout.id,
    venue_id: layout.venue_id,
    name: layout.name,
    description: layout.description,
    is_archived: layout.is_archived,
    created_at: layout.created_at,
    sessions_count: sessionsOnLayout(layout.id).length,
  };
}

// Мок GET /admin/venues/{id}/layouts — конфигурации площадки по порядку,
// без архивных. Форма ответа: { data: HallLayoutSummary[] }.
export function listVenueLayouts(venueId) {
  const ids = layoutIdsByVenue.get(venueId) ?? [];
  return { data: ids.map((id) => summarize(layoutsById.get(id))) };
}

// Мок GET /admin/layouts/{id} — конфигурация целиком: зоны, сектора, места.
export function getLayout(layoutId) {
  return { data: withSeats(requireLayout(layoutId)) };
}

function validationError(details) {
  return new HallLayoutError('VALIDATION_ERROR', 'Ошибка валидации', details);
}

// Проверка черновика целиком. Ошибки схемы (пересечения, пустые сектора,
// ряды без зоны) редактор показывает до отправки, но сервер их повторяет:
// черновик мог прийти не из редактора.
function checkDraft(draft) {
  const details = [];
  if (!String(draft?.name ?? '').trim()) {
    details.push({ field: 'name', message: 'Укажите название конфигурации' });
  }
  if (!Array.isArray(draft?.price_zones) || draft.price_zones.length === 0) {
    details.push({ field: 'price_zones', message: 'Нужна хотя бы одна ценовая зона' });
  }
  if (!Array.isArray(draft?.sections) || draft.sections.length === 0) {
    details.push({ field: 'sections', message: 'Нужен хотя бы один сектор' });
  }
  if (details.length > 0) throw validationError(details);
  const issues = layoutIssues({
    canvas_width: CANVAS_WIDTH,
    canvas_height: CANVAS_HEIGHT,
    ...draft,
  });
  if (issues.length > 0) {
    throw validationError(
      issues.map((issue) => ({ field: 'sections', message: issue.text }))
    );
  }
}

function stripDraft(draft) {
  const copy = clone(draft);
  for (const section of copy.sections) delete section.seats;
  return {
    name: copy.name.trim(),
    description: copy.description ?? '',
    canvas_width: copy.canvas_width ?? CANVAS_WIDTH,
    canvas_height: copy.canvas_height ?? CANVAS_HEIGHT,
    price_zones: copy.price_zones,
    sections: copy.sections,
  };
}

// Мок POST /admin/layouts/{id}/revisions — сохранить правку конфигурации.
// Конфигурация, на которую уже есть сеансы, не меняется: создаётся новая,
// старая уходит в архив и остаётся у этих сеансов. Новая встаёт на место
// старой в списке площадки, и будущие сеансы получают уже её.
// Ответ: { data: HallLayout, revision: 'updated' | 'created' }.
export function saveLayoutRevision(layoutId, draft) {
  const current = requireLayout(layoutId);
  if (current.is_archived) {
    throw new HallLayoutError(
      'LAYOUT_ARCHIVED',
      'Конфигурация в архиве, её нельзя изменить'
    );
  }
  checkDraft(draft);
  const fields = stripDraft(draft);

  const sessions = sessionsOnLayout(layoutId);
  if (sessions.length === 0) {
    const updated = { ...current, ...fields };
    layoutsById.set(layoutId, updated);
    return { data: withSeats(updated), revision: 'updated' };
  }

  // Сеансы, которые жили на конфигурации по умолчанию, привязываем к
  // старой явно — иначе после замены они молча переехали бы на новую.
  for (const session of sessions) {
    if (!sessionHalls.has(session.id))
      sessionHalls.set(session.id, resolveSessionHall(session));
  }
  const created = {
    ...current,
    ...fields,
    id: newId(),
    is_archived: false,
    created_at: isoNow(),
  };
  layoutsById.set(created.id, created);
  layoutsById.set(layoutId, { ...current, is_archived: true });
  const ids = layoutIdsByVenue.get(current.venue_id);
  ids.splice(ids.indexOf(layoutId), 1, created.id);
  return { data: withSeats(created), revision: 'created' };
}

// Мок GET /admin/sessions/{id}/hall — какая конфигурация у сеанса, цены по
// зонам и сколько билетов уже продано (от этого зависит, можно ли сменить
// конфигурацию).
export function getSessionHall(sessionId) {
  const session = requireSession(sessionId);
  const hall = resolveSessionHall(session);
  return {
    data: { session_id: session.id, ...clone(hall), sold_count: soldCount(session) },
  };
}

// Мок PUT /admin/sessions/{id}/hall — выбрать конфигурацию и задать цены.
// Пока на сеанс есть брони или заказы, конфигурацию сменить нельзя (цены
// тоже: проданные билеты уже посчитаны по старым).
export function saveSessionHall(sessionId, { layout_id: layoutId, prices }) {
  const session = requireSession(sessionId);
  const current = resolveSessionHall(session);
  const layout = requireLayout(layoutId);

  if (soldCount(session) > 0) {
    throw new HallLayoutError(
      'SESSION_HAS_BOOKINGS',
      'На сеанс уже есть брони или заказы, схему и цены изменить нельзя'
    );
  }
  if (layout.venue_id !== session.venue.id) {
    throw validationError([
      { field: 'layout_id', message: 'Конфигурация другой площадки' },
    ]);
  }
  if (layout.is_archived && layout.id !== current.layout_id) {
    throw validationError([{ field: 'layout_id', message: 'Конфигурация в архиве' }]);
  }

  const byZone = new Map((prices ?? []).map((p) => [p.price_zone_id, p.price]));
  const details = [];
  const normalized = layout.price_zones.map((z) => {
    const raw = byZone.get(z.id);
    const value = Number(raw);
    if (
      raw === undefined ||
      raw === null ||
      raw === '' ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      details.push({
        field: `prices.${z.id}`,
        message: `Укажите цену для зоны «${z.name}»`,
      });
      return null;
    }
    return { price_zone_id: z.id, price: toMoney(value) };
  });
  if (details.length > 0) throw validationError(details);

  const hall = { layout_id: layout.id, prices: normalized };
  sessionHalls.set(session.id, hall);
  return { data: { session_id: session.id, ...clone(hall), sold_count: 0 } };
}

// Только для тестов: вернуть сиды в исходное состояние.
export function __resetHallLayouts() {
  layoutsById.clear();
  layoutIdsByVenue.clear();
  sessionHalls.clear();
  seed();
}
