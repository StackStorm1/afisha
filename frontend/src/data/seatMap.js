import { uuid } from '../lib/uuid.js';
import { toMoney } from '../lib/money.js';
import { createSeededRandom, pick } from '../lib/seededRandom.js';
import { getSession } from './events.js';

// Партер/балкон — requirements.md §3: минимум две ценовые категории.
// Балкон — последние ~30% рядов, дешевле (коэффициент к базовой цене).
const BALCONY_SHARE = 0.3;
const BALCONY_FACTOR = 0.6;
const STALLS_FACTOR = 1;

// Первый ряд балкона в зале на rowsCount рядов — общая с buildSeatMap
// формула, чтобы текстовое описание зала (страница события) не разошлось
// со схемой зала.
export function getBalconyStartRow(rowsCount) {
  return Math.ceil(rowsCount * (1 - BALCONY_SHARE)) + 1;
}

function hashSeed(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

const seatMapCache = new Map();

function buildSeatMap(session) {
  const { venue } = session;
  const random = createSeededRandom(hashSeed(session.id));
  const balconyStartRow = getBalconyStartRow(venue.rows_count);

  const takenCount = session.total_seats - session.seats_left;
  const seatIndexes = Array.from({ length: session.total_seats }, (_, i) => i);
  // Тасуем детерминированно (Fisher–Yates с фиксированным сидом), чтобы
  // занятые места не были всегда первыми N подряд — так реалистичнее.
  for (let i = seatIndexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [seatIndexes[i], seatIndexes[j]] = [seatIndexes[j], seatIndexes[i]];
  }
  const takenSet = new Set(seatIndexes.slice(0, takenCount));

  const rows = [];
  let seatCounter = 0;
  for (let rowNo = 1; rowNo <= venue.rows_count; rowNo += 1) {
    const isBalcony = rowNo >= balconyStartRow;
    const priceCategory = isBalcony ? 'balcony' : 'stalls';
    const factor = isBalcony ? BALCONY_FACTOR : STALLS_FACTOR;
    const price = toMoney(Number(session.price) * factor);

    const seats = [];
    for (let seatNo = 1; seatNo <= venue.seats_per_row; seatNo += 1) {
      const taken = takenSet.has(seatCounter);
      seatCounter += 1;
      seats.push({
        id: uuid(random),
        seat_no: seatNo,
        price_category: priceCategory,
        price,
        status: taken ? pick(random, ['held', 'paid']) : 'free',
        held_by_me: false,
      });
    }
    rows.push({ row_no: rowNo, seats });
  }

  return {
    session_id: session.id,
    status: session.status,
    price: session.price,
    rows,
  };
}

// Мок GET /sessions/{id}/seats — форма ответа: { data: SeatMap }. Схема
// кэшируется по session.id, чтобы повторный запрос (например, после выбора
// места) отдавал то же состояние, а не пересобирал его заново.
export function getSeatMap(sessionId) {
  if (seatMapCache.has(sessionId)) return seatMapCache.get(sessionId);

  const session = getSession(sessionId);
  if (!session) return null;

  const seatMap = buildSeatMap(session);
  seatMapCache.set(sessionId, seatMap);
  return seatMap;
}

export function findSeat(sessionId, seatId) {
  const seatMap = getSeatMap(sessionId);
  if (!seatMap) return null;
  for (const row of seatMap.rows) {
    const seat = row.seats.find((s) => s.id === seatId);
    if (seat) return { ...seat, row_no: row.row_no };
  }
  return null;
}
