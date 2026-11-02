import { formatCount, formatPrice } from './format.js';

// Тексты подсказки при наведении на схему: заголовок, цена, строка
// мелко и что будет по клику.

// state — как у seatState, плюс lost: место заняли, пока человек выбирал.
export function seatTip({ seat, section, zone, state, lost = false }) {
  const base = {
    name: `Ряд ${seat.row_label}, место ${seat.seat_label}`,
    sub: zone ? `${section.name} · ${zone.name}` : section.name,
  };
  if (lost) return { ...base, price: 'Только что заняли', hint: null };
  if (state === 'taken') return { ...base, price: 'Место занято', hint: null };
  const price = zone ? formatPrice(zone.price) : '';
  if (seat.held_by_me) return { ...base, price, hint: 'Уже в вашей брони' };
  return {
    ...base,
    price,
    hint: state === 'selected' ? 'Нажмите, чтобы убрать' : 'Нажмите, чтобы выбрать',
  };
}

// Сектор целиком: стоячая зона или сидячий сектор, который открывается
// крупно.
export function sectionTip(section, summary) {
  const standing = section.kind === 'standing';
  if (summary.soldOut) {
    return { name: section.name, price: 'Билетов нет', sub: null, hint: null };
  }
  const from = !standing && summary.priceFrom ? 'от ' : '';
  return {
    name: section.name,
    price: `${from}${formatPrice(summary.minPrice)}`,
    sub: `осталось ${formatCount(summary.available)}`,
    hint: standing ? 'Нажмите, чтобы выбрать количество' : 'Нажмите, чтобы выбрать места',
  };
}
