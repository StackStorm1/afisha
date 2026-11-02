// Геометрия сегментной схемы зала: сидячий сектор задаётся не списком мест,
// а параметрами (число рядов, мест в первом и последнем ряду, нумерация,
// ценовые зоны по диапазонам рядов). Места из параметров строит одна
// функция — её используют и редактор схемы, и мини-схемы, и подсчёт
// вместимости, чтобы цифры нигде не разошлись.

// Цвет ценовой зоны не хранится в данных: фронт назначает его по
// sort_order, от яркого (дороже) к тёмному.
export const ZONE_PALETTE = ['#8C88FF', '#6C68EE', '#4F4BC9', '#3A378F'];

export function zoneColor(sortOrder) {
  const index = Math.max(0, sortOrder - 1);
  return ZONE_PALETTE[Math.min(index, ZONE_PALETTE.length - 1)];
}

// Буквы для нумерации рядов: театральный алфавит без Ё, Й, Ъ, Ы, Ь —
// их не используют в подписях рядов.
const ROW_LETTERS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ';

export const ROW_NUMBERING = {
  numeric: 'numeric',
  letters: 'letters',
};

// Подпись ряда по индексу от сцены (0 — первый ряд). Если рядов больше,
// чем букв, буквы идут по второму кругу с номером: «А2», «Б2»…
export function rowLabel(index, numbering = ROW_NUMBERING.numeric) {
  if (numbering !== ROW_NUMBERING.letters) return String(index + 1);
  const letter = ROW_LETTERS[index % ROW_LETTERS.length];
  const round = Math.floor(index / ROW_LETTERS.length);
  return round === 0 ? letter : `${letter}${round + 1}`;
}

// Число мест в каждом ряду: от seats_first у сцены до seats_last в
// последнем ряду, равномерно. Так задаются и прямоугольные сектора
// (first = last), и расширяющиеся к концу зала.
export function rowSeatCounts({
  rows_count: rowsCount,
  seats_first: first,
  seats_last: last,
}) {
  if (!(rowsCount > 0)) return [];
  return Array.from({ length: rowsCount }, (_, i) => {
    const t = rowsCount > 1 ? i / (rowsCount - 1) : 0;
    return Math.max(0, Math.round(first + (last - first) * t));
  });
}

// Ценовая зона ряда (номер ряда с 1) по диапазонам; null — ряд не покрыт.
export function zoneForRow(rowNo, zoneRanges = []) {
  const range = zoneRanges.find((r) => rowNo >= r.from_row && rowNo <= r.to_row);
  return range ? range.price_zone_id : null;
}

// Контур сектора хранится полигоном, как в модели данных. Пока все
// сектора — прямоугольники, и из полигона берётся описывающий прямоугольник.
export function rectShape({ x, y, width, height }) {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
}

export function shapeRect(shape) {
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

// Отступы внутри сектора: сверху место под название, по бокам поле.
const SECTION_PADDING_TOP = 32;
const SECTION_PADDING_BOTTOM = 8;
const SECTION_PADDING_X = 10;

// Шаг сетки мест: самый длинный ряд и все ряды должны влезть в контур.
export function seatPitch(section) {
  const { width, height } = shapeRect(section.shape);
  const counts = rowSeatCounts(section.generator);
  const widest = Math.max(0, ...counts);
  if (counts.length === 0 || widest === 0) return 0;
  const byHeight =
    (height - SECTION_PADDING_TOP - SECTION_PADDING_BOTTOM) / counts.length;
  const byWidth = (width - SECTION_PADDING_X * 2) / widest;
  return Math.max(0, Math.min(byHeight, byWidth));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

// Места сидячего сектора: подпись ряда и места, ценовая зона и центр места
// на холсте. Ряды центрируются по ширине сектора, места нумеруются слева
// направо, ряды — от сцены. id мест выдаёт вызывающий код.
export function generateSeats(section) {
  const { generator } = section;
  const counts = rowSeatCounts(generator);
  const pitch = seatPitch(section);
  const { x, y, width } = shapeRect(section.shape);
  const seats = [];
  counts.forEach((count, rowIndex) => {
    const rowNo = rowIndex + 1;
    const label = rowLabel(rowIndex, generator.numbering);
    const zoneId = zoneForRow(rowNo, generator.zone_ranges);
    const left = x + (width - count * pitch) / 2;
    const cy = y + SECTION_PADDING_TOP + rowIndex * pitch + pitch / 2;
    for (let i = 0; i < count; i += 1) {
      seats.push({
        row_label: label,
        seat_label: String(i + 1),
        price_zone_id: zoneId,
        x: round1(left + i * pitch + pitch / 2),
        y: round1(cy),
      });
    }
  });
  return seats;
}

// Ценовая зона, которой сектор подписывается в списках и мини-схемах:
// у стоячей она одна, у сидячего — зона первого диапазона рядов.
export function sectionZoneId(section) {
  return section.kind === 'standing'
    ? section.price_zone_id
    : (section.generator.zone_ranges[0]?.price_zone_id ?? null);
}

export function sectionCapacity(section) {
  if (section.kind === 'standing') return Math.max(0, section.capacity ?? 0);
  return rowSeatCounts(section.generator).reduce((sum, n) => sum + n, 0);
}

export function layoutCapacity(layout) {
  return layout.sections.reduce((sum, section) => sum + sectionCapacity(section), 0);
}

export function standingCapacity(layout) {
  return layout.sections
    .filter((section) => section.kind === 'standing')
    .reduce((sum, section) => sum + sectionCapacity(section), 0);
}

// Вместимость по ценовым зонам: сидячие места и стоячие отдельно, чтобы
// подписать «49 мест» или «1 800 без мест». Зоны идут по sort_order.
export function zoneCapacities(layout) {
  const byZone = new Map(
    layout.price_zones.map((zone) => [zone.id, { zone, seated: 0, standing: 0 }])
  );
  for (const section of layout.sections) {
    if (section.kind === 'standing') {
      const entry = byZone.get(section.price_zone_id);
      if (entry) entry.standing += sectionCapacity(section);
      continue;
    }
    rowSeatCounts(section.generator).forEach((count, rowIndex) => {
      const entry = byZone.get(zoneForRow(rowIndex + 1, section.generator.zone_ranges));
      if (entry) entry.seated += count;
    });
  }
  return [...byZone.values()].sort((a, b) => a.zone.sort_order - b.zone.sort_order);
}
