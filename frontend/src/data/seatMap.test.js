import { beforeEach, describe, expect, it } from 'vitest';
import { listEvents, listEventSessions } from './events.js';
import { getSeatMap, __resetSeatMaps } from './seatMap.js';
import {
  __resetHallLayouts,
  getLayout,
  getSessionHall,
  listVenueLayouts,
  saveSessionHall,
} from './hallLayouts.js';
import { expectSeatMap } from './schemaAssertions.js';

function activeSessions() {
  return listEvents({ per_page: 500 })
    .data.flatMap((event) => listEventSessions(event.id))
    .filter((session) => session.status === 'active');
}

function sessionAt(venueName) {
  return activeSessions().find((session) => session.venue.name === venueName);
}

function units(seatMap) {
  let total = 0;
  let free = 0;
  for (const section of seatMap.sections) {
    if (section.kind === 'standing') {
      total += section.capacity;
      free += section.available;
    } else {
      total += section.seats.length;
      free += section.seats.filter((seat) => seat.status === 'free').length;
    }
  }
  return { total, free };
}

beforeEach(() => {
  __resetHallLayouts();
  __resetSeatMaps();
});

describe('seatMap mock — SeatMap по сегментной схеме', () => {
  it('сидячий зал: форма ответа, сектор с местами, зоны партер и балкон', () => {
    const session = sessionAt('Большой театр');
    const seatMap = getSeatMap(session.id);
    expectSeatMap(seatMap);
    expect(seatMap.session_id).toBe(session.id);
    expect(seatMap.price_zones.map((z) => z.name)).toEqual(['Партер', 'Балкон']);
    expect(seatMap.sections.map((s) => s.kind)).toEqual(['seated']);
  });

  it('стадион: танцпол — только счётчики, единицы наружу не отдаются', () => {
    const session = sessionAt('Adrenaline Stadium');
    const seatMap = getSeatMap(session.id);
    expectSeatMap(seatMap);
    const dance = seatMap.sections.find((s) => s.name === 'Танцпол');
    expect(dance).toMatchObject({ kind: 'standing', capacity: 1800, held_by_me: 0 });
    expect(dance.available).toBeLessThanOrEqual(1800);
    expect(dance).not.toHaveProperty('seats');
  });

  it('вместимость и остаток схемы равны total_seats и seats_left сеанса', () => {
    for (const venue of ['Большой театр', 'Adrenaline Stadium']) {
      const session = sessionAt(venue);
      expect(units(getSeatMap(session.id))).toEqual({
        total: session.total_seats,
        free: session.seats_left,
      });
    }
  });

  it('остаток зоны — сумма свободных мест и единиц этой зоны', () => {
    const seatMap = getSeatMap(sessionAt('Adrenaline Stadium').id);
    for (const zone of seatMap.price_zones) {
      let free = 0;
      for (const section of seatMap.sections) {
        if (section.kind === 'standing') {
          if (section.price_zone_id === zone.id) free += section.available;
        } else {
          free += section.seats.filter(
            (seat) => seat.price_zone_id === zone.id && seat.status === 'free'
          ).length;
        }
      }
      expect(zone.available).toBe(free);
    }
  });

  it('цены зон — цены сеанса, самая дешёвая равна цене сеанса в каталоге', () => {
    const session = sessionAt('Adrenaline Stadium');
    const seatMap = getSeatMap(session.id);
    const hall = getSessionHall(session.id).data;
    for (const zone of seatMap.price_zones) {
      expect(zone.price).toBe(hall.prices.find((p) => p.price_zone_id === zone.id).price);
    }
    const cheapest = Math.min(...seatMap.price_zones.map((z) => Number(z.price)));
    expect(cheapest).toBe(Number(session.price));
  });

  it('три статуса места различимы программно: free, held, paid', () => {
    const session = activeSessions().find(
      (s) =>
        s.venue.name === 'Большой театр' &&
        s.seats_left > 0 &&
        s.seats_left < s.total_seats
    );
    const seatMap = getSeatMap(session.id);
    const statuses = new Set(seatMap.sections[0].seats.map((seat) => seat.status));
    expect(statuses).toEqual(new Set(['free', 'held', 'paid']));
  });

  it('повторный запрос отдаёт ту же картину зала', () => {
    const session = sessionAt('Большой театр');
    expect(getSeatMap(session.id)).toEqual(getSeatMap(session.id));
  });

  it('новая конфигурация сеанса без продаж — схема и цены по ней', () => {
    const session = activeSessions().find(
      (s) => s.venue.name === 'Adrenaline Stadium' && s.seats_left === s.total_seats
    );
    expect(getSeatMap(session.id).layout.name).toBe('Танцпол + трибуны');

    const club = listVenueLayouts(session.venue.id).data.find(
      (l) => l.name === 'Клубная'
    );
    const [floor] = getLayout(club.id).data.price_zones;
    saveSessionHall(session.id, {
      layout_id: club.id,
      prices: [{ price_zone_id: floor.id, price: '2500.00' }],
    });

    const seatMap = getSeatMap(session.id);
    expect(seatMap.layout.name).toBe('Клубная');
    expect(seatMap.price_zones).toEqual([
      { id: floor.id, name: 'Танцпол', sort_order: 1, price: '2500.00', available: 1800 },
    ]);
  });

  it('несуществующий сеанс — null', () => {
    expect(getSeatMap('00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});
