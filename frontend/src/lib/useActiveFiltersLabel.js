import { useFiltersStore } from '../store/useFiltersStore.js';
import { CATEGORIES } from '../data/categories.js';
import { getVenueById } from '../data/venues.js';
import { formatPrice } from './format.js';

const TIME_LABELS = {
  today: 'Сегодня',
  tomorrow: 'Завтра',
  weekend: 'Выходные',
  week: 'На неделе',
  custom: 'Выбранная дата',
};

export function priceRangeLabel(priceMin, priceMax) {
  if (priceMin === null && priceMax === null) return null;
  if (priceMin === null) return `до ${formatPrice(priceMax)}`;
  if (priceMax === null) return `от ${formatPrice(priceMin)}`;
  if (priceMin === priceMax) return formatPrice(priceMin);
  return `${formatPrice(priceMin).replace(' ₽', '')}–${formatPrice(priceMax)}`;
}

export function useActiveFiltersLabel() {
  const { time, priceMin, priceMax, onlyAvailable, category, venueId, age } =
    useFiltersStore();
  const parts = [];
  if (time) parts.push(TIME_LABELS[time]);
  parts.push(priceRangeLabel(priceMin, priceMax));
  if (category) parts.push(CATEGORIES.find((c) => c.code === category)?.name);
  if (venueId) parts.push(getVenueById(venueId)?.name);
  if (age) parts.push(`${age}+`);
  if (onlyAvailable) parts.push('только в продаже');
  return parts.filter(Boolean).join(' · ');
}
