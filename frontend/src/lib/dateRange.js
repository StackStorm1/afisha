function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// Переводит выбор чипа времени в date_from/date_to для фильтра каталога.
// Контекстные чипы вместо календаря, но границы дат честные: «Выходные» —
// ближайшие суббота и воскресенье, «На неделе» — 7 дней вперёд.
export function timeToDateRange(time, day) {
  const today = new Date(new Date().toISOString().slice(0, 10));

  if (time === 'custom' && day) return { date_from: day, date_to: day };
  if (time === 'today')
    return { date_from: toDateOnly(today), date_to: toDateOnly(today) };
  if (time === 'tomorrow') {
    const tomorrow = addDays(today, 1);
    return { date_from: toDateOnly(tomorrow), date_to: toDateOnly(tomorrow) };
  }
  if (time === 'weekend') {
    const dow = today.getUTCDay(); // 0=вс..6=сб
    const daysToSaturday = (6 - dow + 7) % 7;
    const saturday = addDays(today, daysToSaturday);
    const sunday = addDays(saturday, 1);
    return { date_from: toDateOnly(saturday), date_to: toDateOnly(sunday) };
  }
  if (time === 'week') {
    return { date_from: toDateOnly(today), date_to: toDateOnly(addDays(today, 6)) };
  }
  return { date_from: undefined, date_to: undefined };
}
