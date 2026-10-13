import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetHallLayouts,
  getLayout,
  getSessionHall,
  listVenueLayouts,
  saveLayoutRevision,
  saveSessionHall,
} from './hallLayouts.js';
import { VENUES } from './venues.js';
import { listEvents, listEventSessions } from './events.js';
import { layoutCapacity, standingCapacity, zoneCapacities } from '../lib/hallLayout.js';
import { expectMoney, expectUuid } from './schemaAssertions.js';

const STADIUM = VENUES.find((v) => v.name === 'Adrenaline Stadium');

function stadiumLayout(name) {
  const summary = listVenueLayouts(STADIUM.id).data.find((l) => l.name === name);
  return getLayout(summary.id).data;
}

const sessions = listEvents({ per_page: 500 }).data.flatMap((e) =>
  listEventSessions(e.id)
);
const soldSession = sessions.find((s) => s.total_seats > s.seats_left);
const freshSession = sessions.find((s) => s.total_seats === s.seats_left);

beforeEach(() => {
  __resetHallLayouts();
});

describe('конфигурации площадки', () => {
  it('у стадиона три конфигурации, у остальных площадок по одной', () => {
    expect(listVenueLayouts(STADIUM.id).data.map((l) => l.name)).toEqual([
      'Танцпол + трибуны',
      'Сидячий партер',
      'Клубная',
    ]);
    for (const venue of VENUES.filter((v) => v !== STADIUM)) {
      expect(listVenueLayouts(venue.id).data).toHaveLength(1);
    }
  });

  it('«Танцпол + трибуны» совпадает по цифрам с макетом', () => {
    const layout = stadiumLayout('Танцпол + трибуны');
    expect(layoutCapacity(layout)).toBe(2648);
    expect(standingCapacity(layout)).toBe(1800);
    expect(
      zoneCapacities(layout).map((z) => [z.zone.name, z.seated + z.standing])
    ).toEqual([
      ['VIP', 49],
      ['Трибуна', 311],
      ['Танцпол', 1800],
      ['Балкон', 488],
    ]);
  });

  it('сидячий зал площадки повторяет её сетку рядов и мест', () => {
    const venue = VENUES[0];
    const layout = getLayout(listVenueLayouts(venue.id).data[0].id).data;
    expect(layoutCapacity(layout)).toBe(venue.rows_count * venue.seats_per_row);
  });

  it('места отдаются с uuid, одинаковыми при повторном запросе', () => {
    const first = stadiumLayout('Сидячий партер');
    const again = stadiumLayout('Сидячий партер');
    const seats = first.sections[0].seats;
    expectUuid(seats[0].id);
    expect(again.sections[0].seats.map((s) => s.id)).toEqual(seats.map((s) => s.id));
    expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length);
  });

  it('у стоячей зоны мест нет, только вместимость', () => {
    const floor = stadiumLayout('Клубная').sections[0];
    expect(floor.kind).toBe('standing');
    expect(floor.capacity).toBe(1800);
    expect(floor.seats).toBeUndefined();
  });
});

describe('сохранение ревизии', () => {
  it('конфигурация без сеансов меняется на месте', () => {
    const club = stadiumLayout('Клубная');
    expect(
      listVenueLayouts(STADIUM.id).data.find((l) => l.id === club.id).sessions_count
    ).toBe(0);
    const { data, revision } = saveLayoutRevision(club.id, { ...club, name: 'Клуб' });
    expect(revision).toBe('updated');
    expect(data.id).toBe(club.id);
    expect(getLayout(club.id).data.name).toBe('Клуб');
  });

  it('конфигурация с сеансами уходит в архив, вместо неё новая', () => {
    const dance = stadiumLayout('Танцпол + трибуны');
    const before = listVenueLayouts(STADIUM.id).data[0];
    expect(before.sessions_count).toBeGreaterThan(0);

    const { data, revision } = saveLayoutRevision(dance.id, {
      ...dance,
      name: 'Танцпол v2',
    });
    expect(revision).toBe('created');
    expect(data.id).not.toBe(dance.id);
    expect(getLayout(dance.id).data.is_archived).toBe(true);

    const after = listVenueLayouts(STADIUM.id).data;
    expect(after[0].id).toBe(data.id);
    expect(after[0].sessions_count).toBe(0);
    expect(after.map((l) => l.id)).not.toContain(dance.id);
  });

  it('старые сеансы остаются на архивной конфигурации', () => {
    const dance = stadiumLayout('Танцпол + трибуны');
    const session = sessions.find((s) => s.venue.id === STADIUM.id);
    saveLayoutRevision(dance.id, { ...dance, name: 'Танцпол v2' });
    expect(getSessionHall(session.id).data.layout_id).toBe(dance.id);
  });

  it('пустой черновик не сохраняется', () => {
    const club = stadiumLayout('Клубная');
    expect(() =>
      saveLayoutRevision(club.id, { ...club, name: ' ', sections: [] })
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});

describe('конфигурация и цены сеанса', () => {
  it('по умолчанию у сеанса первая конфигурация площадки и цены на все зоны', () => {
    const { data } = getSessionHall(freshSession.id);
    const layout = getLayout(data.layout_id).data;
    expect(layout.venue_id).toBe(freshSession.venue.id);
    expect(data.prices.map((p) => p.price_zone_id)).toEqual(
      layout.price_zones.map((z) => z.id)
    );
    data.prices.forEach((p) => expectMoney(p.price));
    expect(data.sold_count).toBe(0);
  });

  it('продажи сеанса считаются из остатка мест', () => {
    const { data } = getSessionHall(soldSession.id);
    expect(data.sold_count).toBe(soldSession.total_seats - soldSession.seats_left);
  });

  it('без цены у любой зоны сохранить нельзя', () => {
    const { data } = getSessionHall(freshSession.id);
    const prices = data.prices.slice(1);
    expect(() =>
      saveSessionHall(freshSession.id, { layout_id: data.layout_id, prices })
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('цены сохраняются строкой Money', () => {
    const { data } = getSessionHall(freshSession.id);
    const prices = data.prices.map((p) => ({ ...p, price: '1500' }));
    const saved = saveSessionHall(freshSession.id, {
      layout_id: data.layout_id,
      prices,
    }).data;
    expect(saved.prices.every((p) => p.price === '1500.00')).toBe(true);
    expect(getSessionHall(freshSession.id).data.prices).toEqual(saved.prices);
  });

  it('при проданных билетах схему сменить нельзя', () => {
    const { data } = getSessionHall(soldSession.id);
    expect(() => saveSessionHall(soldSession.id, data)).toThrow(
      expect.objectContaining({ code: 'SESSION_HAS_BOOKINGS' })
    );
  });

  it('конфигурацию чужой площадки выбрать нельзя', () => {
    const other = VENUES.find((v) => v.id !== freshSession.venue.id);
    const foreign = listVenueLayouts(other.id).data[0].id;
    expect(() =>
      saveSessionHall(freshSession.id, { layout_id: foreign, prices: [] })
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
