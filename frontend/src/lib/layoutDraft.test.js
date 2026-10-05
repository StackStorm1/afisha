import { describe, expect, it } from 'vitest';
import { createDraft, draftReducer, LIMITS } from './layoutDraft.js';
import { rectShape, sectionCapacity } from './hallLayout.js';

const LAYOUT = {
  id: 'l1',
  venue_id: 'v1',
  name: 'Танцпол + трибуны',
  canvas_width: 840,
  canvas_height: 640,
  price_zones: [
    { id: 'stand', name: 'Трибуна', sort_order: 2 },
    { id: 'vip', name: 'VIP', sort_order: 1 },
  ],
  sections: [
    {
      id: 'b',
      name: 'Сектор B',
      kind: 'seated',
      sort_order: 1,
      shape: rectShape({ x: 200, y: 380, width: 440, height: 180 }),
      generator: {
        rows_count: 12,
        seats_first: 24,
        seats_last: 36,
        numbering: 'numeric',
        zone_ranges: [
          { from_row: 1, to_row: 2, price_zone_id: 'vip' },
          { from_row: 3, to_row: 12, price_zone_id: 'stand' },
        ],
      },
      seats: [{ id: 'seat' }],
    },
    {
      id: 'd',
      name: 'Танцпол',
      kind: 'standing',
      sort_order: 2,
      shape: rectShape({ x: 300, y: 120, width: 240, height: 170 }),
      capacity: 1800,
      price_zone_id: 'stand',
    },
  ],
};

function section(state, id) {
  return state.layout.sections.find((s) => s.id === id);
}

describe('черновик конфигурации', () => {
  it('создаётся без мест, первый сектор выбран, правок нет', () => {
    const state = createDraft(LAYOUT);
    expect(section(state, 'b').seats).toBeUndefined();
    expect(state.selectedId).toBe('b');
    expect(state.dirty).toBe(false);
    expect(LAYOUT.sections[0].seats).toHaveLength(1);
  });

  it('выбор сектора не считается правкой', () => {
    const state = draftReducer(createDraft(LAYOUT), { type: 'select', id: 'd' });
    expect(state.selectedId).toBe('d');
    expect(state.dirty).toBe(false);
  });

  it('число рядов тянет диапазон, который кончался на последнем ряду', () => {
    const state = draftReducer(createDraft(LAYOUT), {
      type: 'setGenerator',
      id: 'b',
      patch: { rows_count: '14' },
    });
    expect(section(state, 'b').generator.rows_count).toBe(14);
    expect(
      section(state, 'b').generator.zone_ranges.map((r) => [r.from_row, r.to_row])
    ).toEqual([
      [1, 2],
      [3, 14],
    ]);
    expect(state.dirty).toBe(true);
  });

  it('числа в полях ограничены и не уходят в минус', () => {
    let state = createDraft(LAYOUT);
    state = draftReducer(state, {
      type: 'setGenerator',
      id: 'b',
      patch: { rows_count: '5000' },
    });
    state = draftReducer(state, {
      type: 'setGenerator',
      id: 'b',
      patch: { seats_first: '-3' },
    });
    state = draftReducer(state, {
      type: 'setGenerator',
      id: 'b',
      patch: { seats_last: '' },
    });
    const { generator } = section(state, 'b');
    expect(generator.rows_count).toBe(LIMITS.rows);
    expect(generator.seats_first).toBe(0);
    expect(generator.seats_last).toBe(0);
  });

  it('сидячий сектор в стоячую зону: вместимость и зона сохраняются', () => {
    const state = draftReducer(createDraft(LAYOUT), {
      type: 'setKind',
      id: 'b',
      kind: 'standing',
    });
    const b = section(state, 'b');
    expect(b).toMatchObject({ kind: 'standing', capacity: 360, price_zone_id: 'vip' });
    expect(b.generator).toBeUndefined();
    expect(b.shape).toEqual(LAYOUT.sections[0].shape);
  });

  it('стоячая зона в сидячий сектор: ряды по умолчанию в её зоне', () => {
    const state = draftReducer(createDraft(LAYOUT), {
      type: 'setKind',
      id: 'd',
      kind: 'seated',
    });
    const d = section(state, 'd');
    expect(d.kind).toBe('seated');
    expect(d.capacity).toBeUndefined();
    expect(d.price_zone_id).toBeUndefined();
    expect(d.generator.zone_ranges).toEqual([
      { from_row: 1, to_row: d.generator.rows_count, price_zone_id: 'stand' },
    ]);
    expect(sectionCapacity(d)).toBeGreaterThan(0);
  });

  it('диапазоны рядов добавляются после последнего, меняются и удаляются', () => {
    let state = draftReducer(createDraft(LAYOUT), {
      type: 'updateRange',
      id: 'b',
      index: 1,
      patch: { to_row: '10' },
    });
    state = draftReducer(state, { type: 'addRange', id: 'b' });
    expect(section(state, 'b').generator.zone_ranges[2]).toEqual({
      from_row: 11,
      to_row: 12,
      price_zone_id: 'vip',
    });
    state = draftReducer(state, { type: 'removeRange', id: 'b', index: 0 });
    expect(section(state, 'b').generator.zone_ranges.map((r) => r.from_row)).toEqual([
      3, 11,
    ]);
  });

  it('новый сектор получает свободное имя и сразу выбран', () => {
    const state = draftReducer(createDraft(LAYOUT), { type: 'addSection', id: 'new' });
    expect(section(state, 'new')).toMatchObject({
      name: 'Сектор 3',
      kind: 'seated',
      sort_order: 3,
    });
    expect(section(state, 'new').generator.zone_ranges[0].price_zone_id).toBe('vip');
    expect(state.selectedId).toBe('new');
  });

  it('удаление выбранного сектора выбирает первый оставшийся', () => {
    const state = draftReducer(createDraft(LAYOUT), { type: 'removeSection', id: 'b' });
    expect(state.layout.sections.map((s) => s.id)).toEqual(['d']);
    expect(state.selectedId).toBe('d');
  });

  it('после публикации черновик чистый', () => {
    let state = draftReducer(createDraft(LAYOUT), {
      type: 'rename',
      id: 'd',
      name: 'Партер',
    });
    expect(state.dirty).toBe(true);
    state = draftReducer(state, { type: 'published', layout: state.layout });
    expect(state.dirty).toBe(false);
    expect(section(state, 'd').name).toBe('Партер');
  });
});
