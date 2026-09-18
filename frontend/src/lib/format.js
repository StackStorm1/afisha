const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

// "2 900 ₽" — неразрывные пробелы между тройками разрядов.
export function formatPrice(amount) {
  const rounded = Math.round(Number(amount));
  return `${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
}

// "14 сен, пн · 20:00"
export function formatSessionWhen(isoDate) {
  const date = new Date(isoDate);
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const dow = WEEKDAYS[date.getUTCDay()];
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month}, ${dow} · ${hours}:${minutes}`;
}

export function formatTime(isoDate) {
  const date = new Date(isoDate);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function isSameCalendarDay(isoDate, reference) {
  const a = new Date(isoDate);
  const b = reference;
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// Русская плюрализация: 1 событие / 2 события / 5 событий.
export function pluralize(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} ${few}`;
  return `${count} ${many}`;
}

export function pluralizeEvents(count) {
  return pluralize(count, 'событие', 'события', 'событий');
}

export function pluralizeSessions(count) {
  return pluralize(count, 'сеанс', 'сеанса', 'сеансов');
}

// "2 ч 40 мин"
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours} ч`);
  if (mins > 0 || hours === 0) parts.push(`${mins} мин`);
  return parts.join(' ');
}
