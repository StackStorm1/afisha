import { rectShape, sectionCapacity } from './hallLayout.js';

// Черновик конфигурации зала в редакторе. Все правки идут через редьюсер,
// на сервер черновик уходит целиком по «Опубликовать». Места в черновике
// не хранятся: их каждый раз строит генератор из параметров сектора.

// Пределы полей: защищают от опечатки вроде 5000 рядов, которая повесила
// бы предпросмотр. Реальные залы в них укладываются с запасом.
export const LIMITS = {
  rows: 100,
  seatsPerRow: 200,
  capacity: 100000,
};

const NEW_SECTION_RECT = { x: 320, y: 230, width: 200, height: 180 };
const NEW_SECTION_ROWS = 6;
const NEW_SECTION_SEATS = 12;

function clampInt(value, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function stripSeats(layout) {
  const copy = structuredClone(layout);
  for (const section of copy.sections) delete section.seats;
  return copy;
}

export function createDraft(layout) {
  const draft = stripSeats(layout);
  return { layout: draft, selectedId: draft.sections[0]?.id ?? null, dirty: false };
}

function firstZoneId(layout) {
  const [first] = [...layout.price_zones].sort((a, b) => a.sort_order - b.sort_order);
  return first?.id ?? null;
}

function seatedGenerator(rows, seats, zoneId) {
  return {
    rows_count: rows,
    seats_first: seats,
    seats_last: seats,
    numbering: 'numeric',
    zone_ranges: zoneId ? [{ from_row: 1, to_row: rows, price_zone_id: zoneId }] : [],
  };
}

function mapSection(state, id, fn) {
  const sections = state.layout.sections.map((section) =>
    section.id === id ? fn(section) : section
  );
  return { ...state, layout: { ...state.layout, sections }, dirty: true };
}

// Смена числа рядов тянет за собой диапазон, который заканчивался на
// последнем ряду: «Ряды 3–12» при 14 рядах становится «Ряды 3–14». Иначе
// новые ряды оставались бы без зоны после каждой правки.
function resizeRanges(ranges, oldRows, newRows) {
  return ranges.map((range) =>
    range.to_row === oldRows && newRows >= range.from_row
      ? { ...range, to_row: newRows }
      : range
  );
}

function setGenerator(section, patch) {
  const generator = { ...section.generator };
  if ('rows_count' in patch) {
    const rows = clampInt(patch.rows_count, LIMITS.rows);
    generator.zone_ranges = resizeRanges(
      generator.zone_ranges,
      generator.rows_count,
      rows
    );
    generator.rows_count = rows;
  }
  if ('seats_first' in patch)
    generator.seats_first = clampInt(patch.seats_first, LIMITS.seatsPerRow);
  if ('seats_last' in patch)
    generator.seats_last = clampInt(patch.seats_last, LIMITS.seatsPerRow);
  if ('numbering' in patch) generator.numbering = patch.numbering;
  return { ...section, generator };
}

// Общие поля сектора; поля, специфичные для типа, собираются заново.
function sectionBase({ id, name, shape, sort_order }) {
  return { id, name, shape, sort_order };
}

// Смена типа сохраняет то, что можно: стоячая зона получает вместимость и
// зону бывших мест, сидячий сектор — зону бывшей стоячей.
function setKind(state, section, kind) {
  if (section.kind === kind) return section;
  if (kind === 'standing') {
    return {
      ...sectionBase(section),
      kind,
      capacity: sectionCapacity(section),
      price_zone_id:
        section.generator.zone_ranges[0]?.price_zone_id ?? firstZoneId(state.layout),
    };
  }
  return {
    ...sectionBase(section),
    kind,
    generator: seatedGenerator(
      NEW_SECTION_ROWS,
      NEW_SECTION_SEATS,
      section.price_zone_id ?? firstZoneId(state.layout)
    ),
  };
}

function nextSectionName(sections) {
  const names = new Set(sections.map((s) => s.name));
  let n = sections.length + 1;
  while (names.has(`Сектор ${n}`)) n += 1;
  return `Сектор ${n}`;
}

export function draftReducer(state, action) {
  switch (action.type) {
    case 'select':
      return { ...state, selectedId: action.id };

    case 'rename':
      return mapSection(state, action.id, (s) => ({ ...s, name: action.name }));

    case 'setKind':
      return mapSection(state, action.id, (s) => setKind(state, s, action.kind));

    case 'setGenerator':
      return mapSection(state, action.id, (s) => setGenerator(s, action.patch));

    case 'setCapacity':
      return mapSection(state, action.id, (s) => ({
        ...s,
        capacity: clampInt(action.capacity, LIMITS.capacity),
      }));

    case 'setZone':
      return mapSection(state, action.id, (s) => ({
        ...s,
        price_zone_id: action.zoneId,
      }));

    case 'addRange':
      return mapSection(state, action.id, (s) => {
        const { rows_count: rows, zone_ranges: ranges } = s.generator;
        const lastTo = ranges.reduce((max, r) => Math.max(max, r.to_row), 0);
        const from = Math.min(lastTo + 1, Math.max(rows, 1));
        const range = {
          from_row: from,
          to_row: Math.max(rows, from),
          price_zone_id: firstZoneId(state.layout),
        };
        return { ...s, generator: { ...s.generator, zone_ranges: [...ranges, range] } };
      });

    case 'updateRange':
      return mapSection(state, action.id, (s) => {
        const patch = { ...action.patch };
        for (const key of ['from_row', 'to_row']) {
          if (key in patch) patch[key] = clampInt(patch[key], LIMITS.rows);
        }
        const zone_ranges = s.generator.zone_ranges.map((r, i) =>
          i === action.index ? { ...r, ...patch } : r
        );
        return { ...s, generator: { ...s.generator, zone_ranges } };
      });

    case 'removeRange':
      return mapSection(state, action.id, (s) => ({
        ...s,
        generator: {
          ...s.generator,
          zone_ranges: s.generator.zone_ranges.filter((_, i) => i !== action.index),
        },
      }));

    case 'addSection': {
      const { sections } = state.layout;
      const section = {
        id: action.id,
        name: nextSectionName(sections),
        kind: 'seated',
        shape: rectShape(NEW_SECTION_RECT),
        sort_order: sections.reduce((max, s) => Math.max(max, s.sort_order), 0) + 1,
        generator: seatedGenerator(
          NEW_SECTION_ROWS,
          NEW_SECTION_SEATS,
          firstZoneId(state.layout)
        ),
      };
      return {
        layout: { ...state.layout, sections: [...sections, section] },
        selectedId: section.id,
        dirty: true,
      };
    }

    case 'removeSection': {
      const sections = state.layout.sections.filter((s) => s.id !== action.id);
      const selectedId =
        state.selectedId === action.id ? (sections[0]?.id ?? null) : state.selectedId;
      return { layout: { ...state.layout, sections }, selectedId, dirty: true };
    }

    // Сервер принял черновик. Если он создал новую конфигурацию, id у неё
    // другой; выбранный сектор сохраняем, если он есть в ответе.
    case 'published': {
      const layout = stripSeats(action.layout);
      const keep = layout.sections.some((s) => s.id === state.selectedId);
      return {
        layout,
        selectedId: keep ? state.selectedId : (layout.sections[0]?.id ?? null),
        dirty: false,
      };
    }

    default:
      return state;
  }
}
