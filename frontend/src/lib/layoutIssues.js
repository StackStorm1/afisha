import { rowSeatCounts, shapeRect, zoneForRow } from './hallLayout.js';

// Проверки черновика конфигурации зала. Пока есть хоть одна ошибка,
// публиковать нельзя: редактор показывает их сразу при правке, сервер
// (здесь — мок) повторяет те же проверки при сохранении.
//
// Ошибка: {
//   key,         — стабильный ключ для списка
//   sectionId,   — сектор, к которому ведёт действие
//   sectionIds,  — все сектора, которые помечаются на схеме и в списке
//   geometry,    — ошибка положения (пересечение, край холста): на холсте
//                  штриховка; иначе пунктирная обводка
//   field,       — поле свойств с ошибкой; без него действие «Показать»,
//                  с ним — «Исправить» и фокус в поле
//   fieldText,   — короткий текст под полем
//   text,        — строка в панели ошибок
// }

function title(section) {
  return `«${section.name.trim() || 'Без названия'}»`;
}

function kindTitle(section) {
  return section.kind === 'standing'
    ? `с зоной ${title(section)}`
    : `с сектором ${title(section)}`;
}

// Касаться краями можно, пересекаться площадью — нет.
function overlaps(a, b) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function outsideCanvas({ x, y, width, height }, layout) {
  return (
    x < 0 || y < 0 || x + width > layout.canvas_width || y + height > layout.canvas_height
  );
}

// Номера рядов подряд → «ряд 3», «ряды 9–12», «ряды 1–2, 5».
function rowRanges(rows) {
  const parts = [];
  let start = rows[0];
  let prev = rows[0];
  for (const row of [...rows.slice(1), null]) {
    if (row === prev + 1) {
      prev = row;
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}–${prev}`);
    start = row;
    prev = row;
  }
  const word = rows.length === 1 ? 'ряд' : 'ряды';
  return `${word} ${parts.join(', ')}`;
}

function seatedIssues(section, zoneIds) {
  const { generator } = section;
  const name = title(section);
  const base = { sectionId: section.id, sectionIds: [section.id], geometry: false };

  if (!(generator.rows_count > 0)) {
    return [
      {
        ...base,
        key: `${section.id}:rows`,
        field: 'rows_count',
        fieldText: 'Нужен хотя бы один ряд',
        text: `У ${name} нулевая вместимость: нет ни одного ряда`,
      },
    ];
  }

  // Между первым и последним рядом число мест растёт линейно, так что
  // пустым может быть только крайний ряд. При одном ряде «последний» не
  // используется.
  const issues = [];
  const single = generator.rows_count === 1;
  const emptyFirst = !(generator.seats_first > 0);
  const emptyLast = !single && !(generator.seats_last > 0);
  if (emptyFirst || emptyLast) {
    const text =
      single || (emptyFirst && emptyLast)
        ? `У ${name} нулевая вместимость: в рядах нет мест`
        : `У ${name} нет мест в ${emptyFirst ? 'первом' : 'последнем'} ряду`;
    issues.push({
      ...base,
      key: `${section.id}:seats`,
      field: emptyFirst ? 'seats_first' : 'seats_last',
      fieldText: 'Нужно хотя бы одно место',
      text,
    });
  }

  const uncovered = rowSeatCounts(generator)
    .map((_, i) => i + 1)
    .filter((row) => !zoneIds.has(zoneForRow(row, generator.zone_ranges)));
  if (uncovered.length > 0) {
    const rows = rowRanges(uncovered);
    issues.push({
      ...base,
      key: `${section.id}:zones`,
      field: 'zone_ranges',
      fieldText: `${rows[0].toUpperCase()}${rows.slice(1)} без ценовой зоны`,
      text: `В ${name} ${rows} без ценовой зоны`,
    });
  }
  return issues;
}

function standingIssues(section, zoneIds) {
  const name = title(section);
  const base = { sectionId: section.id, sectionIds: [section.id], geometry: false };
  const issues = [];
  if (!(section.capacity > 0)) {
    issues.push({
      ...base,
      key: `${section.id}:capacity`,
      field: 'capacity',
      fieldText: 'Вместимость должна быть больше нуля',
      text: `У ${name} нулевая вместимость`,
    });
  }
  if (!zoneIds.has(section.price_zone_id)) {
    issues.push({
      ...base,
      key: `${section.id}:zone`,
      field: 'price_zone_id',
      fieldText: 'Выберите ценовую зону',
      text: `У ${name} не выбрана ценовая зона`,
    });
  }
  return issues;
}

export function layoutIssues(layout) {
  const { sections } = layout;
  if (sections.length === 0) {
    return [
      {
        key: 'empty',
        sectionId: null,
        sectionIds: [],
        geometry: false,
        field: null,
        text: 'В конфигурации нет ни одного сектора',
      },
    ];
  }

  const zoneIds = new Set(layout.price_zones.map((zone) => zone.id));
  const rects = sections.map((section) => shapeRect(section.shape));
  const issues = [];

  sections.forEach((section, i) => {
    // Пересечение пишется один раз на пару, от сектора ниже по списку:
    // «Показать» выбирает его — обычно его только что и сдвинули.
    for (let j = 0; j < i; j += 1) {
      if (!overlaps(rects[i], rects[j])) continue;
      const other = sections[j];
      issues.push({
        key: `${section.id}:overlap:${other.id}`,
        sectionId: section.id,
        sectionIds: [section.id, other.id],
        geometry: true,
        field: null,
        text: `${title(section)} пересекается ${kindTitle(other)}`,
      });
    }
    if (outsideCanvas(rects[i], layout)) {
      issues.push({
        key: `${section.id}:outside`,
        sectionId: section.id,
        sectionIds: [section.id],
        geometry: true,
        field: null,
        text: `${title(section)} выходит за край схемы`,
      });
    }
    issues.push(
      ...(section.kind === 'standing'
        ? standingIssues(section, zoneIds)
        : seatedIssues(section, zoneIds))
    );
  });
  return issues;
}

// Сектора с ошибками: id → { geometry } для схемы и списка.
export function issuesBySection(issues) {
  const map = new Map();
  for (const issue of issues) {
    for (const id of issue.sectionIds) {
      const entry = map.get(id) ?? { geometry: false };
      entry.geometry ||= issue.geometry;
      map.set(id, entry);
    }
  }
  return map;
}

// Ошибки полей выбранного сектора: field → текст под полем.
export function fieldErrors(issues, sectionId) {
  const map = new Map();
  for (const issue of issues) {
    if (issue.sectionId === sectionId && issue.field)
      map.set(issue.field, issue.fieldText);
  }
  return map;
}
