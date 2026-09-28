import { useState } from 'react';
import FilterPopover from './FilterPopover.jsx';
import { useFiltersStore } from '../store/useFiltersStore.js';
import { priceRangeLabel } from '../lib/useActiveFiltersLabel.js';
import styles from './FilterPopover.module.css';

const PRESETS = [1000, 1500, 3000, 5000];

export default function PriceFilter() {
  const [open, setOpen] = useState(false);
  const priceMin = useFiltersStore((s) => s.priceMin);
  const priceMax = useFiltersStore((s) => s.priceMax);
  const setPriceMin = useFiltersStore((s) => s.setPriceMin);
  const setPriceMax = useFiltersStore((s) => s.setPriceMax);
  const setPriceRange = useFiltersStore((s) => s.setPriceRange);
  const clearPrice = useFiltersStore((s) => s.clearPrice);

  const active = priceMin !== null || priceMax !== null;
  const label = active ? `Цена ${priceRangeLabel(priceMin, priceMax)}` : 'Цена';

  return (
    <FilterPopover
      label={label}
      active={active}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      onClose={() => setOpen(false)}
    >
      <span className={styles.panelLabel}>Цена билета, ₽</span>
      <div className={styles.panelRow}>
        <label className={styles.field}>
          <span className={styles.fieldPrefix}>от</span>
          <input
            type="number"
            min="0"
            step="100"
            inputMode="numeric"
            className={styles.fieldInput}
            placeholder="0"
            aria-label="Цена от, ₽"
            value={priceMin ?? ''}
            onChange={(e) => setPriceMin(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldPrefix}>до</span>
          <input
            type="number"
            min="0"
            step="100"
            inputMode="numeric"
            className={styles.fieldInput}
            placeholder="любая"
            aria-label="Цена до, ₽"
            value={priceMax ?? ''}
            onChange={(e) => setPriceMax(e.target.value)}
          />
        </label>
      </div>
      <div className={styles.panelRow}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={styles.preset}
            data-active={priceMin === null && priceMax === preset}
            onClick={() => setPriceRange(null, preset)}
          >
            до {preset.toLocaleString('ru-RU')}
          </button>
        ))}
      </div>
      <div className={styles.panelFooter}>
        <button
          type="button"
          className={styles.resetButton}
          disabled={!active}
          onClick={clearPrice}
        >
          Сбросить цену
        </button>
      </div>
    </FilterPopover>
  );
}
