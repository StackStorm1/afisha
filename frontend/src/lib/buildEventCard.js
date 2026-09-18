import { deriveCardBadge } from './cardBadge.js';
import { formatSessionWhen } from './format.js';

export function sessionInRange(session, date_from, date_to) {
  if (session.status !== 'active') return false;
  if (date_from && session.starts_at < `${date_from}T00:00:00Z`) return false;
  if (date_to && session.starts_at > `${date_to}T23:59:59Z`) return false;
  return true;
}

// Общая форма карточки каталога — используется лентой, подборками, героем
// и пустым состоянием, чтобы не разойтись в трактовке бейджей/цены.
export function buildEventCard(event, session) {
  const badge = deriveCardBadge(session);
  return {
    id: event.id,
    sessionId: session.id,
    title: event.title,
    category: event.category,
    ageRating: event.age_rating,
    posterUrl: event.poster_url,
    when: formatSessionWhen(session.starts_at),
    startsAt: session.starts_at,
    venue: session.venue,
    ...badge,
  };
}
