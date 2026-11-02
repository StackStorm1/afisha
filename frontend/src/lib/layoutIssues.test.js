import { describe, expect, it } from 'vitest';
import { fieldErrors, issuesBySection, layoutIssues } from './layoutIssues.js';
import { rectShape } from './hallLayout.js';
import { getLayout, listVenueLayouts } from '../data/hallLayouts.js';
import { VENUES } from '../data/venues.js';

function seated(id, name, rect, generator = {}) {
  return {
    id,
    name,
    kind: 'seated',
    sort_order: 1,
    shape: rectShape(rect),
    generator: {
      rows_count: 8,
      seats_first: 26,
      seats_last: 35,
      numbering: 'numeric',
      zone_ranges: [{ from_row: 1, to_row: 8, price_zone_id: 'balcony' }],
      ...generator,
    },
  };
}

function standing(id, name, rect, patch = {}) {
  return {
    id,
    name,
    kind: 'standing',
    sort_order: 1,
    shape: rectShape(rect),
    capacity: 1800,
    price_zone_id: 'dance',
    ...patch,
  };
}

function layout(sections) {
  return {
    canvas_width: 840,
    canvas_height: 640,
    price_zones: [
      { id: 'dance', name: 'Танцпол', sort_order: 3 },
      { id: 'balcony', name: 'Балкон', sort_order: 4 },
    ],
    sections,
  };
}

const DANCE = standing('dance', 'Танцпол', { x: 300, y: 120, width: 240, height: 170 });

describe('проверка схемы', () => {
  it('6c: «Сектор C» налез на танцпол, у «Ложи 1» нет рядов', () => {
    const issues = layoutIssues(
      layout([
        DANCE,
        seated('a', 'Сектор A', { x: 60, y: 120, width: 200, height: 220 }),
        seated('c', 'Сектор C', { x: 500, y: 150, width: 200, height: 220 }),
        seated(
          'l',
          'Ложа 1',
          { x: 60, y: 400, width: 110, height: 80 },
          { rows_count: 0, zone_ranges: [] }
        ),
      ])
    );
    expect(issues.map((i) => i.text)).toEqual([
      '«Сектор C» пересекается с зоной «Танцпол»',
      'У «Ложа 1» нулевая вместимость: нет ни одного ряда',
    ]);
    expect(issues[0]).toMatchObject({
      sectionId: 'c',
      sectionIds: ['c', 'dance'],
      geometry: true,
      field: null,
    });
    expect(issues[1]).toMatchObject({
      sectionId: 'l',
      geometry: false,
      field: 'rows_count',
      fieldText: 'Нужен хотя бы один ряд',
    });

    const marked = issuesBySection(issues);
    expect([...marked.keys()].sort()).toEqual(['c', 'dance', 'l']);
    expect(marked.get('dance').geometry).toBe(true);
    expect(marked.get('l').geometry).toBe(false);
  });

  it('сектора, касающиеся краями, не пересекаются', () => {
    const issues = layoutIssues(
      layout([
        DANCE,
        seated('a', 'Сектор A', { x: 540, y: 120, width: 200, height: 170 }),
        seated('b', 'Сектор B', { x: 300, y: 290, width: 240, height: 100 }),
      ])
    );
    expect(issues).toEqual([]);
  });

  it('пересечение с сидячим сектором названо «с сектором»', () => {
    const [issue] = layoutIssues(
      layout([
        seated('a', 'Сектор A', { x: 0, y: 100, width: 200, height: 200 }),
        seated('b', 'Сектор B', { x: 100, y: 100, width: 200, height: 200 }),
      ])
    );
    expect(issue.text).toBe('«Сектор B» пересекается с сектором «Сектор A»');
  });

  it('стоячая зона без вместимости и без ценовой зоны', () => {
    const issues = layoutIssues(
      layout([
        DANCE,
        standing(
          'f',
          'Фан-зона',
          { x: 0, y: 400, width: 100, height: 100 },
          { capacity: 0, price_zone_id: null }
        ),
      ])
    );
    expect(issues.map((i) => [i.text, i.field])).toEqual([
      ['У «Фан-зона» нулевая вместимость', 'capacity'],
      ['У «Фан-зона» не выбрана ценовая зона', 'price_zone_id'],
    ]);
  });

  it('пустые ряды: все, первый или последний', () => {
    const rect = { x: 0, y: 400, width: 200, height: 200 };
    const text = (generator) =>
      layoutIssues(layout([seated('a', 'Сектор A', rect, generator)])).map((i) => [
        i.text,
        i.field,
      ]);
    expect(text({ seats_first: 0, seats_last: 0 })).toEqual([
      ['У «Сектор A» нулевая вместимость: в рядах нет мест', 'seats_first'],
    ]);
    expect(text({ seats_first: 0 })).toEqual([
      ['У «Сектор A» нет мест в первом ряду', 'seats_first'],
    ]);
    expect(text({ seats_last: 0 })).toEqual([
      ['У «Сектор A» нет мест в последнем ряду', 'seats_last'],
    ]);
    // При одном ряде «в последнем» не используется.
    expect(text({ rows_count: 1, seats_last: 0 })).toEqual([]);
  });

  it('ряды без ценовой зоны перечислены диапазонами', () => {
    const issues = layoutIssues(
      layout([
        seated(
          'b',
          'Сектор B',
          { x: 0, y: 400, width: 400, height: 200 },
          {
            rows_count: 12,
            zone_ranges: [
              { from_row: 2, to_row: 4, price_zone_id: 'balcony' },
              { from_row: 6, to_row: 8, price_zone_id: 'balcony' },
              { from_row: 9, to_row: 12, price_zone_id: 'deleted' },
            ],
          }
        ),
      ])
    );
    expect(issues.map((i) => [i.text, i.field, i.fieldText])).toEqual([
      [
        'В «Сектор B» ряды 1, 5, 9–12 без ценовой зоны',
        'zone_ranges',
        'Ряды 1, 5, 9–12 без ценовой зоны',
      ],
    ]);
  });

  it('сектор за краем холста', () => {
    const issues = layoutIssues(
      layout([seated('a', 'Сектор A', { x: 700, y: 500, width: 200, height: 200 })])
    );
    expect(issues.map((i) => [i.text, i.geometry])).toEqual([
      ['«Сектор A» выходит за край схемы', true],
    ]);
  });

  it('конфигурация без секторов', () => {
    expect(layoutIssues(layout([])).map((i) => i.text)).toEqual([
      'В конфигурации нет ни одного сектора',
    ]);
  });

  it('ошибки полей берутся только у выбранного сектора', () => {
    const issues = layoutIssues(
      layout([
        standing(
          'f',
          'Фан-зона',
          { x: 0, y: 0, width: 100, height: 100 },
          { capacity: 0 }
        ),
        seated('l', 'Ложа', { x: 200, y: 0, width: 100, height: 100 }, { rows_count: 0 }),
      ])
    );
    expect([...fieldErrors(issues, 'l')]).toEqual([
      ['rows_count', 'Нужен хотя бы один ряд'],
    ]);
    expect([...fieldErrors(issues, 'f')]).toEqual([
      ['capacity', 'Вместимость должна быть больше нуля'],
    ]);
  });

  it('все конфигурации из мока проходят проверку', () => {
    for (const venue of VENUES) {
      for (const { id } of listVenueLayouts(venue.id).data) {
        expect(layoutIssues(getLayout(id).data)).toEqual([]);
      }
    }
  });
});
