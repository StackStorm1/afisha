import { useEffect, useRef } from 'react';
import styles from './CancelOrderDialog.module.css';

const ERRORS = {
  SESSION_ALREADY_STARTED: 'Сеанс уже начался, отменить заказ нельзя',
  ORDER_NOT_CANCELLABLE: 'Этот заказ уже нельзя отменить',
  ORDER_NOT_FOUND: 'Заказ не найден',
};
const FALLBACK_ERROR = 'Не удалось отменить заказ. Попробуйте ещё раз';

// Подтверждение отмены заказа (US-17). Нативный <dialog> в модальном режиме
// сам держит фокус внутри, закрывается по Esc и делает фон инертным.
// Пока запрос идёт, закрыть диалог нельзя: иначе непонятно, отменён ли заказ.
export default function CancelOrderDialog({ row, pending, error, onConfirm, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  function onCancel(e) {
    // Esc: событие cancel. Пока идёт запрос, игнорируем.
    e.preventDefault();
    if (!pending) onClose();
  }

  function onBackdropClick(e) {
    if (e.target === ref.current && !pending) onClose();
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="cancel-order-title"
      aria-describedby="cancel-order-text"
      onCancel={onCancel}
      onClick={onBackdropClick}
    >
      <div className={styles.panel}>
        <h2 id="cancel-order-title" className={styles.title}>
          Отменить заказ?
        </h2>

        <div className={styles.order}>
          <span className={styles.orderTitle}>{row.title}</span>
          <span className={styles.orderLine}>
            {row.when} · {row.venue}
          </span>
          <span className={styles.orderLine}>
            {row.seats} · {row.total}
          </span>
          <span className={styles.orderNumber}>{row.number}</span>
        </div>

        <p id="cancel-order-text" className={styles.text}>
          Места освободятся, и их смогут купить другие. Отменённый заказ восстановить
          нельзя.
        </p>

        {error && (
          <p className={styles.error} role="alert">
            {ERRORS[error.code] ?? FALLBACK_ERROR}
          </p>
        )}

        <div className={styles.actions}>
          {/* Фокус по умолчанию на безопасном действии. */}
          <button
            type="button"
            className={styles.secondary}
            onClick={onClose}
            disabled={pending}
            autoFocus
          >
            Не отменять
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Отменяем…' : 'Отменить заказ'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
