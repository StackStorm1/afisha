import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import PosterImage from '../components/PosterImage.jsx';
import { listMyOrders } from '../data/orders.js';
import { useAuth } from '../store/useAuth.js';
import { buildOrderRow, groupUpcoming, splitOrders } from '../lib/orderView.js';
import styles from './OrdersPage.module.css';

// per_page — максимум контракта. Больше сотни заказов у посетителя в MVP не
// ожидается, поэтому постраничной загрузки нет.
const ORDERS_PER_PAGE = 100;

const TABS = [
  { key: 'upcoming', label: 'Предстоящие', empty: 'Предстоящих заказов нет' },
  { key: 'past', label: 'Прошедшие', empty: 'Прошедших заказов нет' },
];

function OrderRow({ order, past }) {
  const row = buildOrderRow(order);
  return (
    <li className={styles.row}>
      <Link
        to={`/events/${row.eventId}`}
        className={styles.poster}
        data-past={past}
        tabIndex={-1}
        aria-hidden="true"
      >
        <PosterImage src={row.posterUrl} alt="" />
      </Link>
      <div className={styles.info}>
        {row.meta && (
          <div className={styles.meta} data-category={row.categoryCode}>
            {row.meta}
          </div>
        )}
        <Link to={`/events/${row.eventId}`} className={styles.title}>
          {row.title}
        </Link>
        <div className={styles.when}>{row.when}</div>
        <div className={styles.venue}>
          <span aria-hidden="true">◉</span>
          {row.venue}
        </div>
      </div>
      <div className={`${styles.cell} ${styles.zoneCell}`}>
        <span className={styles.label}>{row.zone}</span>
        <span className={styles.seats}>{row.seats}</span>
      </div>
      <div className={`${styles.cell} ${styles.numberCell}`}>
        <span className={styles.label}>{row.number}</span>
        <span className={styles.total}>{row.total}</span>
      </div>
      <span className={styles.status} data-status={row.status}>
        <span aria-hidden="true">{row.glyph}</span>
        {row.label}
      </span>
    </li>
  );
}

function EmptyOrders({ text }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyText}>{text}</span>
      <Link to="/" className={styles.cta}>
        В каталог
      </Link>
    </div>
  );
}

export default function OrdersPage() {
  const userId = useAuth((s) => s.user?.id);
  const [tab, setTab] = useState('upcoming');

  // Через react-query, а не напрямую: фоновое истечение броней сбрасывает
  // кэш запросов, и «Ожидает оплаты» сменится на «Отменён» без перезагрузки.
  const { data: orders = [], isPending } = useQuery({
    queryKey: ['orders', userId],
    queryFn: () => listMyOrders({ userId, per_page: ORDERS_PER_PAGE }).data,
  });

  const now = new Date();
  const split = splitOrders(orders, now);
  const current = split[tab];
  const groups =
    tab === 'upcoming'
      ? groupUpcoming(current, now)
      : [{ key: 'past', label: '', meta: '', orders: current }];

  let emptyText = null;
  if (orders.length === 0) emptyText = 'У вас пока нет заказов';
  else if (current.length === 0) emptyText = TABS.find((t) => t.key === tab).empty;

  return (
    <>
      <Header />
      <main className={styles.main}>
        <h1 className={styles.heading}>Мои заказы</h1>

        {/* До ответа не рисуем ни вкладки, ни пустое состояние: иначе на
            мгновение мелькало бы «У вас пока нет заказов». */}
        {!isPending && (
          <>
            <div className={styles.tabs} role="tablist" aria-label="Заказы">
              {TABS.map((t) => {
                const count = split[t.key].length;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    className={styles.tab}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                    {count > 0 && <span className={styles.tabCount}>{count}</span>}
                  </button>
                );
              })}
            </div>

            {emptyText ? (
              <EmptyOrders text={emptyText} />
            ) : (
              <div className={styles.groups} role="tabpanel">
                {groups.map((group) => (
                  <section key={group.key} className={styles.group}>
                    {group.label && (
                      <h2 className={styles.groupHead}>
                        <span className={styles.groupLabel}>{group.label}</span>
                        <span className={styles.groupMeta}>{group.meta}</span>
                      </h2>
                    )}
                    <ul className={styles.list}>
                      {group.orders.map((order) => (
                        <OrderRow key={order.id} order={order} past={tab === 'past'} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
