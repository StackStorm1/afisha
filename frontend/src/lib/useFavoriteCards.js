import { useMemo } from 'react';
import { getEvent } from '../data/events.js';
import { useFavorites } from '../store/useFavorites.js';
import { buildEventCard, nearestActiveSession } from './buildEventCard.js';

// Карточки страницы «Избранное»: событие + его ближайший активный сеанс, как
// в ленте каталога. Последние добавленные — первыми. Событие без активных
// сеансов (все прошли или отменены) карточку собрать не может и не
// показывается, но из избранного не удаляется.
export function useFavoriteCards() {
  const ids = useFavorites((s) => s.ids);

  return useMemo(() => {
    const cards = [];
    for (const id of [...ids].reverse()) {
      const event = getEvent(id);
      const session = event && nearestActiveSession(id);
      if (session) cards.push(buildEventCard(event, session));
    }
    return cards;
  }, [ids]);
}
