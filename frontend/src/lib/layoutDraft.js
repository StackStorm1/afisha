import { rectShape, sectionCapacity, shapeRect } from './hallLayout.js';

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
const NEW_STANDING_CAPACITY = 300;

// Сетка холста: координаты и размеры секторов кратны шагу, так сектора
// легко выровнять друг с другом. Меньше минимального размера сектор не
// сжимается: в него перестают влезать название и хотя бы один ряд.
export const GRID = 10;
export const MIN_SECTION_SIZE = 40;

export function snap(value) {
  return Math.round(value / GRID) * GRID;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Прямоугольник на сетке и целиком на холсте. Сначала размер (не больше
// холста), потом положение — чтобы сектор у края не терял размер.
export function fitRect({ x, y, width, height }, canvas) {
  const w = clamp(snap(width), MIN_SECTION_SIZE, canvas.width);
  const h = clamp(snap(height), MIN_SECTION_SIZE, canvas.height);
  return {
    x: clamp(snap(x), 0, canvas.width - w),
    y: clamp(snap(y), 0, canvas.height - h),
    width: w,
    height: h,
  };
}

export function moveRect(rect, dx, dy, canvas) {
  return fitRect({ ...rect, x: rect.x + dx, y: rect.y + dy }, canvas);
}

// Изменение размера за угловую ручку: противоположный угол стоит на месте,
// перетащить ручку через него нельзя — сектор упирается в минимум.
// corner — 'nw' | 'ne' | 'sw' | 'se'.
export function resizeRect(rect, corner, point, canvas) {
  const px = clamp(snap(point.x), 0, canvas.width);
  const py = clamp(snap(point.y), 0, canvas.height);
  let left = rect.x;
  let right = rect.x + rect.width;
  let top = rect.y;
  let bottom = rect.y + rect.height;
  if (corner.includes('w')) left = Math.min(px, right - MIN_SECTION_SIZE);
  else right = Math.max(px, left + MIN_SECTION_SIZE);
  if (corner.includes('n')) top = Math.min(py, bottom - MIN_SECTION_SIZE);
  else bottom = Math.max(py, top + MIN_SECTION_SIZE);
  return fitRect({ x: left, y: top, width: right - left, height: bottom - top }, canvas);
}

// Новый сектор, нарисованный от точки нажатия до текущей в любую сторону.
// Рамку меньше минимума fitRect доращивает до минимального размера.
export function drawRect(start, point, canvas) {
  const x1 = snap(start.x);
  const y1 = snap(start.y);
  const x2 = snap(point.x);
  const y2 = snap(point.y);
  return fitRect(
    {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    },
    canvas
  );
}

function canvasOf(layout) {
  return { width: layout.canvas_width, height: layout.canvas_height };
}

function sameRect(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

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

function nextSectionName(sections, prefix) {
  const names = new Set(sections.map((s) => s.name));
  let n = sections.length + 1;
  while (names.has(`${prefix} ${n}`)) n += 1;
  return `${prefix} ${n}`;
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

    // Сектор из «+ Сектор» встаёт в центр холста; нарисованный на холсте
    // приходит со своим прямоугольником и типом.
    case 'addSection': {
      const { sections } = state.layout;
      const standing = action.kind === 'standing';
      const base = {
        id: action.id,
        name: nextSectionName(sections, standing ? 'Стоячая зона' : 'Сектор'),
        shape: rectShape(
          fitRect(action.rect ?? NEW_SECTION_RECT, canvasOf(state.layout))
        ),
        sort_order: sections.reduce((max, s) => Math.max(max, s.sort_order), 0) + 1,
      };
      const section = standing
        ? {
            ...base,
            kind: 'standing',
            capacity: NEW_STANDING_CAPACITY,
            price_zone_id: firstZoneId(state.layout),
          }
        : {
            ...base,
            kind: 'seated',
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

    // Новое положение и размер сектора. Прямоугольник приводится к сетке и
    // холсту здесь же, чтобы мышь и клавиатура не разошлись в правилах.
    // Если ничего не сдвинулось (клик без перетаскивания), это не правка.
    case 'setRect': {
      const section = state.layout.sections.find((s) => s.id === action.id);
      if (!section) return state;
      const rect = fitRect(action.rect, canvasOf(state.layout));
      if (sameRect(rect, shapeRect(section.shape))) return state;
      return mapSection(state, action.id, (s) => ({ ...s, shape: rectShape(rect) }));
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
