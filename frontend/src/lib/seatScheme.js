import { ZONE_PALETTE, shapeRect, zoneColor } from './hallLayout.js';

// Вид схемы зала посетителя по ответу GET /sessions/{id}/seats: цвета зон,
// размер мест и сводка по секторам. Геометрия мест уже посчитана в данных
// (x, y — центры на холсте конфигурации), здесь только то, что нужно для
// отрисовки.

// Цвет зоны по sort_order, как в админке. Единственная зона зала — второй
// цвет палитры: первый, самый яркий, означает «дороже остальных», а
// сравнивать не с чем.
export function zoneColors(priceZones) {
  if (priceZones.length === 1) return new Map([[priceZones[0].id, ZONE_PALETTE[1]]]);
  return new Map(priceZones.map((zone) => [zone.id, zoneColor(zone.sort_order)]));
}

// Шаг сетки мест сектора — наименьшее расстояние между соседними местами
// одного ряда, а если в рядах по одному месту — между рядами.
export function seatPitch(seats) {
  let best = Infinity;
  const byRow = new Map();
  for (const seat of seats) {
    const prev = byRow.get(seat.row_label);
    if (prev) best = Math.min(best, Math.abs(seat.x - prev.x));
    byRow.set(seat.row_label, seat);
  }
  if (best === Infinity) {
    const ys = [...new Set(seats.map((seat) => seat.y))].sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i += 1) best = Math.min(best, ys[i] - ys[i - 1]);
  }
  return Number.isFinite(best) && best > 0 ? best : 0;
}

// Подписи рядов слева от сектора: у каждого ряда — его подпись и центр
// крайнего левого места.
export function rowStarts(seats) {
  const rows = new Map();
  for (const seat of seats) {
    const first = rows.get(seat.row_label);
    if (!first || seat.x < first.x) rows.set(seat.row_label, seat);
  }
  return [...rows.values()].map((seat) => ({
    label: seat.row_label,
    x: seat.x,
    y: seat.y,
  }));
}

// Сводка по сектору для блока на схеме и строки в списке секторов:
// остаток, вместимость, самая низкая цена и зона, которой сектор окрашен
// в списке (самая дешёвая из его зон).
export function sectionSummary(section, zonesById) {
  const zoneIds =
    section.kind === 'standing'
      ? [section.price_zone_id]
      : [...new Set(section.seats.map((seat) => seat.price_zone_id))];
  const zones = zoneIds.map((id) => zonesById.get(id)).filter(Boolean);
  const cheapest = zones.reduce(
    (min, zone) => (!min || Number(zone.price) < Number(min.price) ? zone : min),
    null
  );
  const available =
    section.kind === 'standing'
      ? section.available
      : section.seats.filter((seat) => seat.status === 'free').length;
  const total = section.kind === 'standing' ? section.capacity : section.seats.length;
  return {
    zoneIds,
    zoneId: cheapest?.id ?? null,
    minPrice: cheapest ? Number(cheapest.price) : null,
    // «от» — только если в секторе несколько цен.
    priceFrom: new Set(zones.map((zone) => Number(zone.price))).size > 1,
    available,
    total,
    soldOut: available === 0,
  };
}

// Состояние места глазами посетителя: свои удержанные — выбранные, чужие
// удержанные и оплаченные — занятые.
export function seatState(seat) {
  if (seat.held_by_me) return 'selected';
  return seat.status === 'free' ? 'free' : 'taken';
}

export function sectionBounds(section) {
  return shapeRect(section.shape);
}
