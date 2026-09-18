import { getSeatMap } from '../data/seatMap.js';
import { formatPrice } from './format.js';

export const ZONE_LABELS = { stalls: 'Партер', balcony: 'Балкон' };

export function getSessionZones(session) {
  return zonesFromSeatMap(getSeatMap(session.id));
}

function zonesFromSeatMap(seatMap) {
  const byCategory = new Map();
  for (const row of seatMap.rows) {
    for (const seat of row.seats) {
      const zone = byCategory.get(seat.price_category) ?? {
        category: seat.price_category,
        price: Number(seat.price),
        available: 0,
      };
      if (seat.status === 'free') zone.available += 1;
      byCategory.set(seat.price_category, zone);
    }
  }
  return Array.from(byCategory.values());
}

// Честные бейджи срочности и цены — конкретные числа остатка вместо
// субъективного "высокий спрос".
export function deriveCardBadge(session) {
  const zones = getSessionZones(session);
  const availableZones = zones.filter((z) => z.available > 0);
  const left = zones.reduce((sum, z) => sum + z.available, 0);
  const sold = availableZones.length === 0;
  const minAvailable = sold ? null : Math.min(...availableZones.map((z) => z.price));
  const soldPct = Math.round((1 - left / session.total_seats) * 100);

  let badge = null;
  let badgeTone = 'neutral';
  if (sold) {
    badge = 'Продано';
    badgeTone = 'error';
  } else if (left <= 15) {
    badge = `Осталось ${left}`;
    badgeTone = 'warningSolid';
  } else if (soldPct >= 70) {
    badge = `Продано ${soldPct}%`;
    badgeTone = 'warning';
  } else if (availableZones.length === 1 && zones.length > 1) {
    badge = `Остался ${ZONE_LABELS[availableZones[0].category].toLowerCase()}`;
    badgeTone = 'warning';
  }

  // Распроданную категорию определяем по остатку (available === 0), а не по
  // цене — балкон почти всегда дешевле партера, и сравнение цен ошибочно
  // считало распроданным именно балкон, даже когда на самом деле кончился
  // партер (более дорогая категория).
  let note;
  if (sold) {
    note = 'Все места заняты';
  } else if (availableZones.length < zones.length) {
    const soldOutZones = zones.filter((z) => z.available === 0);
    const label = soldOutZones.map((z) => ZONE_LABELS[z.category]).join(', ');
    note = soldOutZones.length > 1 ? `${label} распроданы` : `${label} распродан`;
  } else {
    note = zones.length > 1 ? 'Партер и балкон' : 'Единая цена';
  }

  const priceLabel = sold
    ? 'Продано'
    : zones.length > 1
      ? `от ${formatPrice(minAvailable)}`
      : formatPrice(minAvailable);

  return { sold, badge, badgeTone, note, priceLabel, left, soldPct, minAvailable };
}
