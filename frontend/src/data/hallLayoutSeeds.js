import { uuid } from '../lib/uuid.js';
import { createSeededRandom } from '../lib/seededRandom.js';
import { layoutCapacity, rectShape } from '../lib/hallLayout.js';
import { VENUES } from './venues.js';

// Сиды конфигураций зала: у стадиона три конфигурации, у остальных площадок
// по одной сидячей. Отдельно от мока админки (hallLayouts.js), потому что
// вместимость конфигурации по умолчанию нужна и каталогу сеансов
// (events.js), а мок админки сам зависит от каталога.

export const CANVAS_WIDTH = 840;
export const CANVAS_HEIGHT = 640;

const SEED_CREATED_AT = '2026-09-01T09:00:00Z';

// Партер и балкон у сидячих залов: балкон — последние ~30% рядов.
const BALCONY_SHARE = 0.3;

export function getBalconyStartRow(rowsCount) {
  return Math.ceil(rowsCount * (1 - BALCONY_SHARE)) + 1;
}

// id выдаёт генератор с фиксированным сидом, заново на каждый вызов
// seedLayouts: после сброса мока id те же, что при загрузке.
let newId = null;

function zone(name, sortOrder) {
  return { id: newId(), name, sort_order: sortOrder };
}

function seatedSection({
  name,
  rect,
  rows,
  seatsFirst,
  seatsLast,
  zoneRanges,
  sortOrder,
}) {
  return {
    id: newId(),
    name,
    kind: 'seated',
    shape: rectShape(rect),
    sort_order: sortOrder,
    generator: {
      rows_count: rows,
      seats_first: seatsFirst,
      seats_last: seatsLast ?? seatsFirst,
      numbering: 'numeric',
      zone_ranges: zoneRanges,
    },
  };
}

function standingSection({ name, rect, capacity, zoneId, sortOrder }) {
  return {
    id: newId(),
    name,
    kind: 'standing',
    shape: rectShape(rect),
    sort_order: sortOrder,
    price_zone_id: zoneId,
    capacity,
  };
}

function range(from, to, zoneId) {
  return { from_row: from, to_row: to, price_zone_id: zoneId };
}

function baseLayout(venueId, name, description) {
  return {
    id: newId(),
    venue_id: venueId,
    name,
    description,
    canvas_width: CANVAS_WIDTH,
    canvas_height: CANVAS_HEIGHT,
    is_archived: false,
    created_at: SEED_CREATED_AT,
  };
}

// Три конфигурации большой площадки — как на экране выбора конфигурации
// в админке: танцпол с трибунами, сидячий партер, клубная.
function stadiumLayouts(venueId) {
  const danceVip = zone('VIP', 1);
  const danceStand = zone('Трибуна', 2);
  const danceFloor = zone('Танцпол', 3);
  const danceBalcony = zone('Балкон', 4);
  const dance = {
    ...baseLayout(venueId, 'Танцпол + трибуны', 'Партер стоячий, сектора A–C сидячие.'),
    price_zones: [danceVip, danceStand, danceFloor, danceBalcony],
    sections: [
      standingSection({
        name: 'Танцпол',
        rect: { x: 300, y: 120, width: 240, height: 170 },
        capacity: 1800,
        zoneId: danceFloor.id,
        sortOrder: 1,
      }),
      seatedSection({
        name: 'Сектор A',
        rect: { x: 60, y: 120, width: 200, height: 220 },
        rows: 8,
        seatsFirst: 26,
        seatsLast: 35,
        zoneRanges: [range(1, 8, danceBalcony.id)],
        sortOrder: 2,
      }),
      seatedSection({
        name: 'Сектор B',
        rect: { x: 200, y: 380, width: 440, height: 180 },
        rows: 12,
        seatsFirst: 24,
        seatsLast: 36,
        zoneRanges: [range(1, 2, danceVip.id), range(3, 12, danceStand.id)],
        sortOrder: 3,
      }),
      seatedSection({
        name: 'Сектор C',
        rect: { x: 580, y: 120, width: 200, height: 220 },
        rows: 8,
        seatsFirst: 26,
        seatsLast: 35,
        zoneRanges: [range(1, 8, danceBalcony.id)],
        sortOrder: 4,
      }),
    ],
  };

  const seatedStalls = zone('Партер', 1);
  const seatedStand = zone('Трибуна', 2);
  const seatedBalcony = zone('Балкон', 3);
  const seated = {
    ...baseLayout(venueId, 'Сидячий партер', 'Вместо танцпола 24 ряда кресел.'),
    price_zones: [seatedStalls, seatedStand, seatedBalcony],
    sections: [
      seatedSection({
        name: 'Партер',
        rect: { x: 280, y: 110, width: 280, height: 260 },
        rows: 24,
        seatsFirst: 48,
        seatsLast: 56,
        zoneRanges: [range(1, 24, seatedStalls.id)],
        sortOrder: 1,
      }),
      seatedSection({
        name: 'Сектор A',
        rect: { x: 40, y: 120, width: 200, height: 220 },
        rows: 8,
        seatsFirst: 26,
        seatsLast: 35,
        zoneRanges: [range(1, 8, seatedBalcony.id)],
        sortOrder: 2,
      }),
      seatedSection({
        name: 'Сектор B',
        rect: { x: 200, y: 400, width: 440, height: 180 },
        rows: 12,
        seatsFirst: 24,
        seatsLast: 36,
        zoneRanges: [range(1, 12, seatedStand.id)],
        sortOrder: 3,
      }),
      seatedSection({
        name: 'Сектор C',
        rect: { x: 600, y: 120, width: 200, height: 220 },
        rows: 8,
        seatsFirst: 26,
        seatsLast: 35,
        zoneRanges: [range(1, 8, seatedBalcony.id)],
        sortOrder: 4,
      }),
    ],
  };

  const clubFloor = zone('Танцпол', 1);
  const club = {
    ...baseLayout(venueId, 'Клубная', 'Только танцпол, трибуны закрыты.'),
    price_zones: [clubFloor],
    sections: [
      standingSection({
        name: 'Танцпол',
        rect: { x: 200, y: 120, width: 440, height: 260 },
        capacity: 1800,
        zoneId: clubFloor.id,
        sortOrder: 1,
      }),
    ],
  };

  return [dance, seated, club];
}

// Остальные площадки: один сидячий зал той же сеткой, что и сейчас у
// посетителя (rows_count × seats_per_row, балкон — последние ряды).
function hallLayout(venue) {
  const stalls = zone('Партер', 1);
  const balcony = zone('Балкон', 2);
  const balconyStart = getBalconyStartRow(venue.rows_count);
  return {
    ...baseLayout(venue.id, 'Основная', 'Весь зал сидячий: партер и балкон.'),
    price_zones: [stalls, balcony],
    sections: [
      seatedSection({
        name: 'Зал',
        rect: { x: 60, y: 110, width: 720, height: 480 },
        rows: venue.rows_count,
        seatsFirst: venue.seats_per_row,
        zoneRanges: [
          range(1, balconyStart - 1, stalls.id),
          range(balconyStart, venue.rows_count, balcony.id),
        ],
        sortOrder: 1,
      }),
    ],
  };
}

// Конфигурации всех площадок по порядку: первая — по умолчанию.
// Map: venue_id → HallLayout[] (без мест, сидячие сектора — генератором).
export function seedLayouts() {
  const random = createSeededRandom(20261005);
  newId = () => uuid(random);
  const byVenue = new Map();
  for (const venue of VENUES) {
    byVenue.set(
      venue.id,
      venue.name === 'Adrenaline Stadium' ? stadiumLayouts(venue.id) : [hallLayout(venue)]
    );
  }
  return byVenue;
}

let defaultCapacities = null;

// Вместимость конфигурации по умолчанию — столько мест у сеанса в каталоге
// (total_seats — снимок числа единиц инвентаря).
export function defaultLayoutCapacity(venueId) {
  if (!defaultCapacities) {
    defaultCapacities = new Map(
      [...seedLayouts()].map(([id, layouts]) => [id, layoutCapacity(layouts[0])])
    );
  }
  return defaultCapacities.get(venueId) ?? 0;
}
