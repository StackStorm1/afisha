import { useFavorites } from '../store/useFavorites.js';
import { useAuth } from '../store/useAuth.js';
import { useRequireLogin } from './loginRedirect.js';

// Сердечко события. Избранное есть только у посетителя: гостя ведём на вход,
// а событие добавляется в избранное уже после входа (см. AuthPage).
export function useFavoriteToggle(eventId) {
  const isFavorite = useFavorites((s) => (eventId ? s.isFavorite(eventId) : false));
  const toggleFavorite = useFavorites((s) => s.toggle);
  const isGuest = useAuth((s) => s.status === 'guest');
  const requireLogin = useRequireLogin();

  function toggle() {
    if (!eventId) return;
    if (isGuest) requireLogin('favorite', { favoriteEventId: eventId });
    else toggleFavorite(eventId);
  }

  return { isFavorite, toggle };
}
