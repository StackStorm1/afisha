import { getSessionZones, listZoneNames } from './cardBadge.js';
import { formatPrice, formatTime, pluralizeSeats } from './format.js';

const LEFT_WARNING_THRESHOLD = 20;

// Строка сеанса в списке «Сеансы» на странице события.
export function buildSessionRowView(session, { authorized }) {
  if (session.status !== 'active') {
    return {
      time: formatTime(session.starts_at),
      venue: session.venue.name,
      zonesLabel: 'Сеанс отменён',
      leftLabel: 'Отменён',
      leftTone: 'error',
      price: null,
      sold: true,
      cancelled: true,
      btnLabel: 'Отменён',
    };
  }

  const zones = getSessionZones(session);
  const availableZones = zones.filter((z) => z.available > 0);
  const left = zones.reduce((sum, z) => sum + z.available, 0);
  const sold = availableZones.length === 0;
  const minAvailable = sold ? null : Math.min(...availableZones.map((z) => z.price));
  const many = zones.length > 1;

  // Распроданная категория — та, у которой available === 0. Не самая
  // дешёвая и не самая дорогая: цена про остаток мест ничего не говорит.
  let zonesLabel;
  if (sold) {
    zonesLabel = `${zones.map((z) => z.name).join(' · ')} — мест нет`;
  } else if (availableZones.length < zones.length) {
    const soldOut = zones.filter((z) => z.available === 0);
    const avail = listZoneNames(availableZones).toLowerCase();
    zonesLabel = `${listZoneNames(soldOut)} ${soldOut.length > 1 ? 'распроданы' : 'распродан'} · ${avail} в продаже`;
  } else {
    zonesLabel = zones.map((z) => `${z.name} ${formatPrice(z.price)}`).join(' · ');
  }

  let leftLabel = `Свободно ${pluralizeSeats(left)}`;
  let leftTone = 'muted';
  if (sold) {
    leftLabel = 'Все места заняты';
    leftTone = 'error';
  } else if (left <= LEFT_WARNING_THRESHOLD) {
    leftLabel = `Свободно ${pluralizeSeats(left)} — почти разобрали`;
    leftTone = 'warning';
  }

  return {
    time: formatTime(session.starts_at),
    venue: session.venue.name,
    zonesLabel,
    leftLabel,
    leftTone,
    price: sold
      ? 'Продано'
      : many
        ? `от ${formatPrice(minAvailable)}`
        : formatPrice(minAvailable),
    sold,
    cancelled: false,
    btnLabel: sold ? 'Продано' : authorized ? 'Выбрать места' : 'Войти и выбрать места',
  };
}
