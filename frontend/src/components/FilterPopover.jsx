import { useEffect, useId, useRef } from 'react';
import styles from './FilterPopover.module.css';

// Чип в строке фильтров с раскрывающейся панелью — для фильтров, которым не
// хватает одной кнопки (диапазон цены, список площадок).
export default function FilterPopover({
  label,
  active = false,
  open,
  onToggle,
  onClose,
  children,
}) {
  const wrapRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) onClose();
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.chip}
        data-active={active}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        {label}
        <span className={styles.caret} aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div className={styles.panel} id={panelId}>
          {children}
        </div>
      )}
    </div>
  );
}
