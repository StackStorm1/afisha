import { formatMonthShort } from './format.js';

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso, days) {
  return toDateOnly(new Date(new Date(iso).getTime() + days * DAY_MS));
}

// Все даты от fromIso до toIso включительно.
export function isoRange(fromIso, toIso) {
  if (toIso < fromIso) return [];
  const dates = [];
  for (let iso = fromIso; iso <= toIso; iso = addDaysIso(iso, 1)) dates.push(iso);
  return dates;
}

// Месяц показывается у первого чипа и при смене месяца: иначе «3» после
// «28 окт» читается как 3 октября.
export function describeDay(iso, previousIso) {
  const date = new Date(iso);
  const month = formatMonthShort(iso);
  return {
    iso,
    num: date.getUTCDate(),
    dow: WEEKDAYS[date.getUTCDay()],
    month,
    showMonth: !previousIso || formatMonthShort(previousIso) !== month,
  };
}
