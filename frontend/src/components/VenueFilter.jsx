import { useState } from 'react';
import FilterPopover from './FilterPopover.jsx';
import { useVenueOptions } from '../lib/useVenueOptions.js';
import { useFiltersStore } from '../store/useFiltersStore.js';
import { pluralizeEvents } from '../lib/format.js';
import styles from './FilterPopover.module.css';

// Площадка — такой же фильтр каталога, как категория и дата, поэтому живёт в
// строке фильтров, а не в плитке на дне главной.
export default function VenueFilter() {
  const [open, setOpen] = useState(false);
  const venues = useVenueOptions();
  const venueId = useFiltersStore((s) => s.venueId);
  const clearVenue = useFiltersStore((s) => s.clearVenue);

  const selected = venues.find((venue) => venue.active);
  const label = selected ? `◉ ${selected.name}` : 'Площадка';

  function pick(venue) {
    venue.pick();
    setOpen(false);
  }

  return (
    <FilterPopover
      label={label}
      active={Boolean(venueId)}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      onClose={() => setOpen(false)}
    >
      <span className={styles.panelLabel}>Площадка</span>
      <div className={styles.optionList}>
        {venues.map((venue) => (
          <button
            key={venue.id}
            type="button"
            className={styles.option}
            data-active={venue.active}
            aria-pressed={venue.active}
            onClick={() => pick(venue)}
          >
            <span className={styles.optionName}>{venue.name}</span>
            <span className={styles.optionMeta}>{pluralizeEvents(venue.count)}</span>
          </button>
        ))}
      </div>
      <div className={styles.panelFooter}>
        <button
          type="button"
          className={styles.resetButton}
          disabled={!venueId}
          onClick={() => {
            clearVenue();
            setOpen(false);
          }}
        >
          Все площадки
        </button>
      </div>
    </FilterPopover>
  );
}
