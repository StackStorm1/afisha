import { useMemo } from 'react';
import { useFiltersStore } from '../store/useFiltersStore.js';
import { listEvents, listEventSessions } from '../data/events.js';
import { timeToDateRange } from './dateRange.js';
import { buildEventCard, sessionInRange } from './buildEventCard.js';

const SMALL_VENUE_CAPACITY = 300;
const LATER_THRESHOLD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Строит карточки каталога: событие + ближайший подходящий под фильтры
// сеанс. Фильтры категории/дат/поиска и сортировка идут через мок GET /events
// (совпадает с формой контракта), венью/цена/возраст/наличие мест — фильтры,
// которых нет в openapi.yaml, поэтому применяются здесь же, на уже
// отфильтрованном наборе.
export function useCatalogFeed() {
  const {
    q,
    time,
    day,
    priceMin,
    priceMax,
    onlyAvailable,
    sort,
    category,
    venueId,
    age,
  } = useFiltersStore();
  const { date_from, date_to } = timeToDateRange(time, day);

  return useMemo(() => {
    const { data: events } = listEvents({
      q,
      date_from,
      date_to,
      category,
      sort,
      per_page: 500,
    });

    const cards = [];
    for (const event of events) {
      if (age && event.age_rating !== `${age}+`) continue;

      const candidates = listEventSessions(event.id)
        .filter((s) => sessionInRange(s, date_from, date_to))
        .filter((s) => !venueId || s.venue.id === venueId)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

      if (candidates.length === 0) continue;

      cards.push(buildEventCard(event, candidates[0]));
    }

    // У распроданной карточки нет доступной цены — под заданную границу она
    // не подходит ни с одной стороны.
    const hasPriceBound = priceMin !== null || priceMax !== null;
    const visibleCards = cards.filter((card) => {
      if ((onlyAvailable || hasPriceBound) && card.sold) return false;
      if (priceMin !== null && card.minAvailable < priceMin) return false;
      if (priceMax !== null && card.minAvailable > priceMax) return false;
      return true;
    });

    const today = new Date(new Date().toISOString().slice(0, 10));
    const laterCutoff = new Date(today.getTime() + LATER_THRESHOLD_DAYS * DAY_MS);

    const rowDefs = [
      {
        key: 'today',
        title: 'Сегодня в Москве',
        why: 'Сеансы начинаются сегодня вечером — ещё можно успеть',
        match: (card) => new Date(card.startsAt) < new Date(today.getTime() + DAY_MS),
      },
      {
        key: 'fast',
        title: 'Быстро раскупают',
        why: 'Продано больше 70% мест или осталась одна ценовая категория',
        match: (card) => !card.sold && (card.soldPct >= 70 || card.left <= 15),
      },
      {
        key: 'small',
        title: 'Маленькие залы',
        why: 'Вместимость до 300 мест — камерный формат',
        match: (card) =>
          card.venue.rows_count * card.venue.seats_per_row <= SMALL_VENUE_CAPACITY,
      },
      {
        key: 'later',
        title: 'Дальше по календарю',
        why: 'Через неделю и позже, если планируете заранее',
        match: (card) => new Date(card.startsAt) >= laterCutoff,
      },
    ];

    const thematicRows = rowDefs.map((row) => ({
      ...row,
      items: visibleCards.filter(row.match),
    }));

    // Тематические полки покрывают не весь набор, поэтому остаток забирает
    // замыкающая полка: иначе «N событий» не совпадает с содержимым ленты.
    const covered = new Set(thematicRows.flatMap((row) => row.items.map((i) => i.id)));
    const rest = visibleCards.filter((card) => !covered.has(card.id));

    const rows = [
      ...thematicRows,
      {
        key: 'rest',
        title: 'Ещё в афише',
        why: 'Подходят под фильтры, но не попали в полки выше',
        items: rest,
      },
    ].filter((row) => row.items.length > 0);

    const weekend = timeToDateRange('weekend', null);
    const { data: weekendEvents } = listEvents({
      date_from: weekend.date_from,
      date_to: weekend.date_to,
      per_page: 20,
    });
    const alternatives = weekendEvents
      .map((event) => {
        const sessions = listEventSessions(event.id).filter((s) =>
          sessionInRange(s, weekend.date_from, weekend.date_to)
        );
        return sessions.length > 0 ? buildEventCard(event, sessions[0]) : null;
      })
      .filter(Boolean);

    return {
      rows,
      isEmpty: rows.length === 0,
      alternatives,
      total: visibleCards.length,
    };
  }, [
    q,
    priceMin,
    priceMax,
    onlyAvailable,
    sort,
    category,
    venueId,
    age,
    date_from,
    date_to,
  ]);
}
