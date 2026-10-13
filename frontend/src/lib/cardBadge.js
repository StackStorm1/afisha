import { getSeatMap } from '../data/seatMap.js';
import { formatPrice, listNames } from './format.js';

// Ценовые зоны сеанса с ценой и остатком — из схемы зала, по sort_order.
export function getSessionZones(session) {
  return getSeatMap(session.id).price_zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    price: Number(zone.price),
    available: zone.available,
  }));
}

export function listZoneNames(zones) {
  return listNames(zones.map((zone) => zone.name));
}

function soldOutWord(count) {
  return count > 1 ? 'распроданы' : 'распродан';
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
    badge = `Только ${availableZones[0].name.toLowerCase()}`;
    badgeTone = 'warning';
  }

  // Распроданная категория — та, у которой available === 0. Не самая
  // дешёвая и не самая дорогая: цена про остаток мест ничего не говорит.
  let note;
  if (sold) {
    note = 'Все места заняты';
  } else if (availableZones.length < zones.length) {
    const soldOutZones = zones.filter((z) => z.available === 0);
    note = `${listZoneNames(soldOutZones)} ${soldOutWord(soldOutZones.length)}`;
  } else {
    note = zones.length > 1 ? listZoneNames(zones) : 'Единая цена';
  }

  const priceLabel = sold
    ? 'Продано'
    : zones.length > 1
      ? `от ${formatPrice(minAvailable)}`
      : formatPrice(minAvailable);

  return { sold, badge, badgeTone, note, priceLabel, left, soldPct, minAvailable };
}
