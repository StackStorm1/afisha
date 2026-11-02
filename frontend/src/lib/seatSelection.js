import { MAX_SEATS_PER_ORDER } from '../data/orders.js';
import { formatPrice, pluralize } from './format.js';

export const MAX_TICKETS = MAX_SEATS_PER_ORDER;

// Выбор посетителя на текущей схеме: только места, которые всё ещё
// свободны, и стоячие зоны, которые есть в зале. Состав для нижней панели
// и тело POST /orders считаются отсюда, чтобы не разойтись.
export function selectionView(seatMap, selection) {
  const prices = new Map(
    seatMap.price_zones.map((zone) => [zone.id, Number(zone.price)])
  );
  const seatIndex = new Map();
  const sectionsById = new Map();
  for (const section of seatMap.sections) {
    sectionsById.set(section.id, section);
    for (const seat of section.seats ?? []) seatIndex.set(seat.id, { seat, section });
  }

  const lines = [];
  const seatIds = [];
  for (const id of selection.seats) {
    const found = seatIndex.get(id);
    if (!found || found.seat.status !== 'free') continue;
    const { seat, section } = found;
    const price = prices.get(seat.price_zone_id);
    seatIds.push(id);
    lines.push({
      key: id,
      kind: 'seat',
      seatId: id,
      text: `${section.name}, ряд ${seat.row_label}, место ${seat.seat_label}`,
      price,
    });
  }

  const standing = [];
  for (const [sectionId, quantity] of Object.entries(selection.standing)) {
    const section = sectionsById.get(sectionId);
    if (!section || section.kind !== 'standing' || quantity < 1) continue;
    standing.push({ section_id: sectionId, quantity });
    lines.push({
      key: sectionId,
      kind: 'standing',
      sectionId,
      text: `${section.name} × ${quantity}`,
      price: prices.get(section.price_zone_id) * quantity,
    });
  }

  const count = seatIds.length + standing.reduce((sum, item) => sum + item.quantity, 0);
  return {
    lines,
    seatIds,
    selectedIds: new Set(seatIds),
    standing,
    count,
    total: lines.reduce((sum, line) => sum + line.price, 0),
    atLimit: count >= MAX_TICKETS,
  };
}

export function ticketsLabel(count) {
  return pluralize(count, 'билет', 'билета', 'билетов');
}

export function lineLabel(line) {
  return `${line.text} · ${formatPrice(line.price)}`;
}

// «Сектор A, ряд 3, место 6» — для сообщений о занятых местах.
export function seatTitle(seatMap, seatId) {
  for (const section of seatMap.sections) {
    const seat = section.seats?.find((s) => s.id === seatId);
    if (seat) return `${section.name}, ряд ${seat.row_label}, место ${seat.seat_label}`;
  }
  return 'Место';
}

// «А», «А и Б», «А; Б и В» — точка с запятой, потому что в самих
// названиях мест уже есть запятые.
export function joinTitles(titles) {
  if (titles.length <= 1) return titles.join('');
  return `${titles.slice(0, -1).join('; ')} и ${titles[titles.length - 1]}`;
}

// Схема без удержаний из orders: их места — уже не «мои», а занятые до
// фоновой очистки. Стоячие зоны теряют столько «моих» единиц, сколько
// было в этих заказах.
export function withoutHolds(seatMap, orders) {
  if (orders.length === 0) return seatMap;
  const ids = new Set(orders.flatMap((order) => order.seats.map((seat) => seat.id)));
  const standingBySection = new Map();
  for (const order of orders) {
    for (const seat of order.seats) {
      if (seat.section.kind !== 'standing') continue;
      standingBySection.set(
        seat.section.id,
        (standingBySection.get(seat.section.id) ?? 0) + 1
      );
    }
  }
  return {
    ...seatMap,
    sections: seatMap.sections.map((section) => {
      if (section.kind === 'standing') {
        const gone = standingBySection.get(section.id) ?? 0;
        return gone
          ? { ...section, held_by_me: Math.max(0, section.held_by_me - gone) }
          : section;
      }
      return {
        ...section,
        seats: section.seats.map((seat) =>
          ids.has(seat.id) && seat.held_by_me ? { ...seat, held_by_me: false } : seat
        ),
      };
    }),
  };
}
