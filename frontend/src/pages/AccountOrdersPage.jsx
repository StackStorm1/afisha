import { useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import OrderCard from '../components/OrderCard.jsx';
import AccountLayout from '../components/AccountLayout.jsx';
import { listMyOrders, cancelOrder, payOrder, seedDemoOrders } from '../data/orders.js';
import styles from './AccountOrdersPage.module.css';

const ORDER_TABS = [
  { key: 'upcoming', label: 'Предстоящие' },
  { key: 'past', label: 'Прошедшие' },
];

// Вкладки делятся по дате сеанса: будущий — «Предстоящие», прошедший —
// «Прошедшие». Предстоящие — по возрастанию (ближайший сверху), прошедшие — по
// убыванию (недавний сверху).
function splitOrders() {
  const now = Date.now();
  const upcoming = [];
  const past = [];
  for (const order of listMyOrders({ per_page: 500 }).data) {
    if (new Date(order.session.starts_at).getTime() > now) upcoming.push(order);
    else past.push(order);
  }
  upcoming.sort((a, b) => a.session.starts_at.localeCompare(b.session.starts_at));
  past.sort((a, b) => b.session.starts_at.localeCompare(a.session.starts_at));
  return { upcoming, past };
}

function EmptyTab({ tab }) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>
        {tab === 'upcoming' ? 'Нет предстоящих заказов' : 'Нет прошедших заказов'}
      </h2>
      <p className={styles.emptyText}>
        {tab === 'upcoming'
          ? 'Выберите событие в каталоге и купите билеты — заказы появятся здесь.'
          : 'Сюда попадут заказы, у которых сеанс уже прошёл.'}
      </p>
      <Link to="/" className={styles.cta}>
        В каталог
      </Link>
    </div>
  );
}

export default function AccountOrdersPage() {
  // Демо-заказы засеиваются один раз, до первого чтения списка.
  useState(() => {
    seedDemoOrders();
    return null;
  });

  const [tab, setTab] = useState('upcoming');
  const [busyId, setBusyId] = useState(null);
  const [, refresh] = useReducer((n) => n + 1, 0);

  const { upcoming, past } = splitOrders();
  const orders = tab === 'upcoming' ? upcoming : past;

  function run(action, orderId) {
    setBusyId(orderId);
    try {
      action(orderId);
    } catch {
      // На моках оплата/отмена для соответствующих статусов не падают; глушим,
      // список всё равно перечитывается через refresh.
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  return (
    <AccountLayout>
      <div className={styles.head}>
        <Link to="/account" className={styles.back}>
          ← Личный кабинет
        </Link>
        <h1 className={styles.ordersTitle}>Мои заказы</h1>
        <p className={styles.subtitle}>
          {upcoming.length} предстоящих · {past.length} прошедших
        </p>
      </div>

      <div className={styles.tabs} role="tablist">
        {ORDER_TABS.map((t) => {
          const count = t.key === 'upcoming' ? upcoming.length : past.length;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={styles.tab}
              data-active={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className={styles.tabCount}>{count}</span>
            </button>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <EmptyTab tab={tab} />
      ) : (
        <div className={styles.list}>
          {orders.map((order) => {
            const isUpcoming = tab === 'upcoming';
            const unpaid = order.status === 'pending' || order.status === 'failed';
            return (
              <OrderCard
                key={order.id}
                order={order}
                canPay={isUpcoming && unpaid}
                canCancel={isUpcoming && order.status === 'paid'}
                paying={busyId === order.id}
                cancelling={busyId === order.id}
                onPay={(id) => run((x) => payOrder(x), id)}
                onCancel={(id) => run(cancelOrder, id)}
              />
            );
          })}
        </div>
      )}
    </AccountLayout>
  );
}
