import { uuid } from '../lib/uuid.js';
import { MOSCOW } from './cities.js';

// Venue из openapi.yaml. rows_count × seats_per_row — прямоугольная сетка,
// requirements.md §3. 6 площадок, как в оценке объёма db-schema.md §7 (5–8).
export const VENUES = [
  {
    id: uuid(),
    name: 'Большой театр',
    address: 'Театральная пл., 1',
    city: MOSCOW,
    rows_count: 20,
    seats_per_row: 30,
  },
  {
    id: uuid(),
    name: 'Крокус Сити Холл',
    address: 'МКАД 66 км, вл 3',
    city: MOSCOW,
    rows_count: 18,
    seats_per_row: 34,
  },
  {
    id: uuid(),
    name: 'Театр Наций',
    address: 'Петровский пер., 3',
    city: MOSCOW,
    rows_count: 12,
    seats_per_row: 20,
  },
  {
    id: uuid(),
    name: 'Stand-up клуб «Микрофон»',
    address: 'ул. Покровка, 15',
    city: MOSCOW,
    rows_count: 8,
    seats_per_row: 12,
  },
  {
    id: uuid(),
    name: 'Adrenaline Stadium',
    address: 'Ленинградское ш., 39А',
    city: MOSCOW,
    rows_count: 25,
    seats_per_row: 40,
  },
  {
    id: uuid(),
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
