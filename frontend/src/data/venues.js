import { uuid } from '../lib/uuid.js';
import { createSeededRandom } from '../lib/seededRandom.js';
import { MOSCOW } from './cities.js';

// Сид, а не Math.random: id площадки уходит в query-строку каталога
// (?venue=…, см. lib/useFilterUrl.js). На случайных id после перезагрузки
// страницы в URL оставался id от прошлой загрузки, и фильтр не совпадал ни
// с одной площадкой — лента пустела, а снять фильтр было нечем: чип
// площадки рисуется только когда getVenueById нашёл её по id.
//
// Сид отличается от сида каталога (data/events.js): генератор
// детерминированный, и на общем сиде первый id площадки совпал бы с первым
// id события. Id привязаны к порядку списка ниже — вставка площадки в
// середину сдвинет id всех следующих.
const random = createSeededRandom(20260917);

// Venue из openapi.yaml. rows_count × seats_per_row — прямоугольная сетка,
// requirements.md §3. 6 площадок, как в оценке объёма db-schema.md §7 (5–8).
export const VENUES = [
  {
    id: uuid(random),
    name: 'Большой театр',
    address: 'Театральная пл., 1',
    city: MOSCOW,
    rows_count: 20,
    seats_per_row: 30,
  },
  {
    id: uuid(random),
    name: 'Крокус Сити Холл',
    address: 'МКАД 66 км, вл 3',
    city: MOSCOW,
    rows_count: 18,
    seats_per_row: 34,
  },
  {
    id: uuid(random),
    name: 'Театр Наций',
    address: 'Петровский пер., 3',
    city: MOSCOW,
    rows_count: 12,
    seats_per_row: 20,
  },
  {
    id: uuid(random),
    name: 'Stand-up клуб «Микрофон»',
    address: 'ул. Покровка, 15',
    city: MOSCOW,
    rows_count: 8,
    seats_per_row: 12,
  },
  {
    id: uuid(random),
    name: 'Adrenaline Stadium',
    address: 'Ленинградское ш., 39А',
    city: MOSCOW,
    rows_count: 25,
    seats_per_row: 40,
  },
  {
    id: uuid(random),
    name: 'ЦДКЖ',
    address: 'Комсомольская пл., 4',
    city: MOSCOW,
    rows_count: 15,
    seats_per_row: 24,
  },
];

export function getVenueById(id) {
  return VENUES.find((venue) => venue.id === id);
}
