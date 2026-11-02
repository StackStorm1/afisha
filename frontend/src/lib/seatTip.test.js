import { describe, expect, it } from 'vitest';
import { sectionTip, seatTip } from './seatTip.js';

const section = { name: 'Партер', kind: 'seated' };
const zone = { name: 'Первые ряды', price: '4000.00' };
const seat = { row_label: '4', seat_label: '2', held_by_me: false };

describe('подсказка места', () => {
  it('свободное — цена, сектор с зоной, «выбрать»', () => {
    expect(seatTip({ seat, section, zone, state: 'free' })).toEqual({
      name: 'Ряд 4, место 2',
      price: '4 000 ₽',
      sub: 'Партер · Первые ряды',
      hint: 'Нажмите, чтобы выбрать',
    });
  });

  it('занятое — без цены и без действия', () => {
    expect(seatTip({ seat, section, zone, state: 'taken' })).toMatchObject({
      price: 'Место занято',
      hint: null,
    });
  });

  it('только что заняли — так и сказано', () => {
    expect(seatTip({ seat, section, zone, state: 'taken', lost: true })).toMatchObject({
      price: 'Только что заняли',
    });
  });

  it('своя бронь — не «убрать»: снять её можно только отменой заказа', () => {
    const mine = { ...seat, held_by_me: true };
    expect(seatTip({ seat: mine, section, zone, state: 'selected' }).hint).toBe(
      'Уже в вашей брони'
    );
  });
});

describe('подсказка сектора', () => {
  const summary = { soldOut: false, minPrice: 2500, priceFrom: true, available: 1312 };

  it('стоячая зона — цена без «от» и про количество', () => {
    expect(sectionTip({ name: 'Танцпол', kind: 'standing' }, summary)).toEqual({
      name: 'Танцпол',
      price: '2 500 ₽',
      sub: 'осталось 1 312',
      hint: 'Нажмите, чтобы выбрать количество',
    });
  });

  it('сидячий сектор с разными ценами — «от»', () => {
    expect(sectionTip({ name: 'Сектор A', kind: 'seated' }, summary)).toMatchObject({
      price: 'от 2 500 ₽',
      hint: 'Нажмите, чтобы выбрать места',
    });
  });

  it('распроданный — «Билетов нет» без действия', () => {
    expect(
      sectionTip({ name: 'Сектор A', kind: 'seated' }, { ...summary, soldOut: true })
    ).toEqual({ name: 'Сектор A', price: 'Билетов нет', sub: null, hint: null });
  });
});
