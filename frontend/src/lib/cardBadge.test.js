import { describe, it, expect } from 'vitest';
import { listEvents, listEventSessions } from '../data/events.js';
import { getSeatMap, setUnitsStatus } from '../data/seatMap.js';
import { deriveCardBadge } from './cardBadge.js';
import { buildSessionRowView } from './sessionRowView.js';

// Сидячий зал с партером и балконом, где есть свободные места.
function findActiveSession() {
  return listEvents({ per_page: 200 })
    .data.flatMap((event) => listEventSessions(event.id))
    .find(
      (s) =>
        s.status === 'active' && s.venue.name !== 'Adrenaline Stadium' && s.seats_left > 0
    );
}

// Балкон дешевле партера, поэтому наивное «распродана та категория, у
// которой минимальная цена» всегда указывало бы на балкон — баг, который
// эти тесты фиксируют явно, продавая именно партер.
function sellOutStalls(session) {
  const seatMap = getSeatMap(session.id);
  const stalls = seatMap.price_zones.find((z) => z.name === 'Партер').id;
  const seats = seatMap.sections.flatMap((section) => section.seats);
  const ids = (inStalls) =>
    seats.filter((seat) => (seat.price_zone_id === stalls) === inStalls).map((s) => s.id);
  setUnitsStatus(session.id, ids(true), 'paid');
  setUnitsStatus(session.id, ids(false), 'free');
}

describe('deriveCardBadge — распроданная категория определяется по остатку, не по цене', () => {
  it('когда распродан более дорогой партер, а балкон свободен — note называет партер', () => {
    const session = findActiveSession();
    sellOutStalls(session);

    const { note, sold } = deriveCardBadge(session);
    expect(sold).toBe(false);
    expect(note).toBe('Партер распродан');
  });
});

describe('buildSessionRowView — та же проверка в строке сеанса на странице события', () => {
  it('zonesLabel называет партер распроданным, а не балкон', () => {
    const session = findActiveSession();
    sellOutStalls(session);

    const { zonesLabel } = buildSessionRowView(session, { authorized: false });
    expect(zonesLabel).toBe('Партер распродан · балкон в продаже');
  });
});
