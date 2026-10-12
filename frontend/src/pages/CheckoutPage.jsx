import { useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Header from '../components/Header.jsx';
import PosterImage from '../components/PosterImage.jsx';
import HoldBanner from '../components/seats/HoldBanner.jsx';
import { getOrder, payOrder } from '../data/orders.js';
import { useAuth } from '../store/useAuth.js';
import { buildOrderRow, isPayable, ticketLines } from '../lib/orderView.js';
import { pluralize } from '../lib/format.js';
import styles from './CheckoutPage.module.css';

function seatsPath(order) {
  return `/events/${order.session.event.id}/sessions/${order.session.id}/seats`;
}

function Message({ title, text, children }) {
  return (
    <div className={styles.message}>
      <h1 className="u-poster">{title}</h1>
      {text && <p className={styles.messageText}>{text}</p>}
      <div className={styles.messageActions}>{children}</div>
    </div>
  );
}

// Заказ, который уже не оплатить: оплачен, отменён, не найден.
function Closed({ order }) {
  if (!order) {
    return (
      <Message title="Заказ не найден">
        <Link to="/account/orders">Мои заказы</Link>
      </Message>
    );
  }
  if (order.status === 'paid') {
    return (
      <Message title="Заказ оплачен" text="Билеты — в «Моих заказах».">
        <Link to="/account/orders">Мои заказы</Link>
      </Message>
    );
  }
  const started = new Date(order.session.starts_at) <= new Date();
  return (
    <Message title="Бронь отменена" text="Места освобождены, оплатить этот заказ нельзя.">
      {!started && (
        <Link to={seatsPath(order)} className={styles.cta}>
          Выбрать места заново
        </Link>
      )}
      <Link to="/account/orders">Мои заказы</Link>
    </Message>
  );
}

// US-14, US-16, BR-05: сводка брони и эмулированная оплата. Сумма — ровно
// total_price заказа: сборов и комиссий в контракте нет.
export default function CheckoutPage() {
  const { orderId } = useParams();
  const userId = useAuth((s) => s.user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const failedRef = useRef(null);

  // Копия: мок меняет заказ на месте, и без новой ссылки react-query не
  // заметил бы смену статуса после перечитывания.
  const { data: order, isPending } = useQuery({
    queryKey: ['order', orderId, userId],
    queryFn: () => {
      const found = getOrder(orderId, { userId });
      return found ? { ...found } : null;
    },
  });

  const backToSeats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['seatMap', order.session.id] });
    navigate(seatsPath(order), { replace: true, state: { bookingExpired: true } });
  }, [navigate, order, queryClient]);

  const pay = useMutation({
    mutationFn: async () => payOrder(orderId, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['seatMap', order.session.id] });
      navigate('/account/orders', { replace: true, state: { paidOrderId: orderId } });
    },
    onError: (error) => {
      // BR-02: бронь истекла — места уже освобождены, назад к схеме.
      if (error.code === 'BOOKING_EXPIRED') {
        backToSeats();
        return;
      }
      // Отказ шлюза оставляет бронь (US-16); уже оплачен или отменён —
      // перечитанный заказ покажет это вместо формы.
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // После отказа фокус на сообщении: кнопка та же, а что случилось, иначе
  // не услышать.
  useEffect(() => {
    if (pay.error?.code === 'PAYMENT_FAILED') failedRef.current?.focus();
  }, [pay.error]);

  let content;
  if (isPending) {
    content = null;
  } else if (!order || !isPayable(order)) {
    // Заказ ждёт оплаты, но время вышло до фоновой очистки — та же
    // развязка, что при 409 BOOKING_EXPIRED.
    content =
      order && (order.status === 'pending' || order.status === 'failed') ? (
        <ExpiredRedirect onExpire={backToSeats} />
      ) : (
        <Closed order={order} />
      );
  } else {
    const row = buildOrderRow(order);
    const lines = ticketLines(order.seats);
    const tickets = pluralize(order.seats.length, 'билет', 'билета', 'билетов');
    const failed = pay.error?.code === 'PAYMENT_FAILED' || order.status === 'failed';
    const otherError =
      pay.error && pay.error.code !== 'PAYMENT_FAILED' ? pay.error.message : null;

    content = (
      <>
        <div className={styles.head}>
          <Link to={seatsPath(order)} className={`${styles.back} u-hit`}>
            <span aria-hidden="true">←</span> К схеме зала
          </Link>
          <h1 className={styles.title}>Оформление заказа</h1>
        </div>

        <div className={styles.layout}>
          <section className={styles.summary} aria-labelledby="checkout-event">
            <div className={styles.event}>
              <div className={styles.poster} aria-hidden="true">
                <PosterImage src={row.posterUrl} alt="" />
              </div>
              <div className={styles.eventInfo}>
                {row.meta && (
                  <span className={styles.meta} data-category={row.categoryCode}>
                    {row.meta}
                  </span>
                )}
                <h2 id="checkout-event" className={styles.eventTitle}>
                  {row.title}
                </h2>
                <span className={styles.when}>{row.when}</span>
                <span className={styles.venue}>
                  {order.session.venue.name} · {order.session.venue.address}
                </span>
              </div>
            </div>

            <h3 className={styles.linesHead}>
              <span>Билеты</span>
              <span className={styles.linesCount}>{tickets}</span>
            </h3>
            <ul className={styles.lines}>
              {lines.map((line) => (
                <li key={line.key} className={styles.line}>
                  <span className={styles.lineTitle}>
                    {line.title}
                    {line.count > 1 && ` × ${line.count}`}
                  </span>
                  <span className={styles.lineZone}>{line.zone}</span>
                  <span className={styles.linePrice}>{line.price}</span>
                </li>
              ))}
            </ul>
          </section>

          <aside className={styles.pay} aria-label="Оплата">
            <span className={styles.number}>{row.number}</span>
            <HoldBanner key={order.id} order={order} onExpire={backToSeats} plain />
            <div className={styles.total}>
              <span className={styles.totalLabel}>Итого</span>
              <span className={styles.totalValue}>{row.total}</span>
            </div>

            {failed && (
              <div className={styles.failed} role="alert" tabIndex={-1} ref={failedRef}>
                <strong>Оплата не прошла</strong>
                {/* Текст ответа шлюза про «данные карты» здесь не к месту:
                    формы карты на экране нет. */}
                <span>
                  Платёж отклонён. Места остаются за вами, пока идёт таймер, — попробуйте
                  ещё раз.
                </span>
              </div>
            )}
            {otherError && (
              <p className={styles.error} role="alert">
                {otherError}
              </p>
            )}

            <button
              type="button"
              className={styles.payButton}
              disabled={pay.isPending}
              onClick={() => pay.mutate()}
            >
              {pay.isPending ? 'Оплата…' : failed ? 'Повторить оплату' : 'Оплатить'}
            </button>
            <p className={styles.note}>
              Оплата тестовая: деньги не списываются, карту вводить не нужно.
            </p>
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className={styles.main}>{content}</main>
    </>
  );
}

function ExpiredRedirect({ onExpire }) {
  useEffect(() => {
    onExpire();
  }, [onExpire]);
  return null;
}
