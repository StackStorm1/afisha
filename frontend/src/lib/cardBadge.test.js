import { describe, it, expect } from 'vitest';
import { listEvents, listEventSessions } from '../data/events.js';
import { getSeatMap } from '../data/seatMap.js';
import { deriveCardBadge } from './cardBadge.js';
import { buildSessionRowView } from './sessionRowView.js';

function findActiveSession() {
  const event = listEvents({ per_page: 200 }).data[0];
  return listEventSessions(event.id).find((s) => s.status === 'active');
}

// Балкон дешевле партера (price_factor), поэтому наивное «распродана та
// категория, у которой минимальная цена» всегда указывало бы на балкон —
// баг, который эти тесты фиксируют явно, продавая именно партер.
function sellOutStalls(session) {
  const seatMap = getSeatMap(session.id);
  for (const row of seatMap.rows) {
    for (const seat of row.seats) {
      if (seat.price_category === 'stalls') seat.status = 'paid';
      if (seat.price_category === 'balcony') seat.status = 'free';
    }
  }
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
