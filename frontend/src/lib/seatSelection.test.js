import { describe, expect, it } from 'vitest';
import { joinTitles, withoutHolds } from './seatSelection.js';
import { formatCountdown } from './useCountdown.js';

describe('seatSelection', () => {
  it('названия мест склеиваются через точку с запятой и «и»', () => {
    expect(joinTitles(['Зал, ряд 1, место 2'])).toBe('Зал, ряд 1, место 2');
    expect(
      joinTitles(['A, ряд 1, место 1', 'A, ряд 1, место 2', 'B, ряд 2, место 5'])
    ).toBe('A, ряд 1, место 1; A, ряд 1, место 2 и B, ряд 2, место 5');
  });

  it('истёкшие брони: их места и единицы уже не свои', () => {
    const seatMap = {
      sections: [
        {
          id: 's',
          kind: 'seated',
          seats: [
            { id: 'a', status: 'held', held_by_me: true },
            { id: 'b', status: 'held', held_by_me: true },
          ],
        },
        { id: 'd', kind: 'standing', held_by_me: 3 },
      ],
    };
    const order = {
      seats: [
        { id: 'a', section: { id: 's', kind: 'seated' } },
        { id: 'u1', section: { id: 'd', kind: 'standing' } },
        { id: 'u2', section: { id: 'd', kind: 'standing' } },
      ],
    };
    const shown = withoutHolds(seatMap, [order]);
    expect(shown.sections[0].seats.map((s) => s.held_by_me)).toEqual([false, true]);
    expect(shown.sections[1].held_by_me).toBe(1);
    expect(withoutHolds(seatMap, [])).toBe(seatMap);
  });

  it('обратный отсчёт: минуты и секунды, секунды округляются вверх', () => {
    expect(formatCountdown(15 * 60 * 1000)).toBe('15:00');
    expect(formatCountdown(61 * 1000)).toBe('1:01');
    expect(formatCountdown(400)).toBe('0:01');
    expect(formatCountdown(0)).toBe('0:00');
  });
});
