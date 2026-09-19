import { useFiltersStore } from '../store/useFiltersStore.js';
import { CATEGORIES } from '../data/categories.js';
import { getVenueById } from '../data/venues.js';

const TIME_LABELS = {
  today: 'Сегодня',
  tomorrow: 'Завтра',
  weekend: 'Выходные',
  week: 'На неделе',
  custom: 'Выбранная дата',
};

export function useActiveFiltersLabel() {
  const { time, priceUnder1500, category, venueId, age } = useFiltersStore();
  const parts = [];
  if (time) parts.push(TIME_LABELS[time]);
  if (priceUnder1500) parts.push('до 1500 ₽');
  if (category) parts.push(CATEGORIES.find((c) => c.code === category)?.name);
  if (venueId) parts.push(getVenueById(venueId)?.name);
  if (age) parts.push(`${age}+`);
  return parts.filter(Boolean).join(' · ');
}
