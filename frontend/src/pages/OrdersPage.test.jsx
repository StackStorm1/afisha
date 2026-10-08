import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App.jsx';
import { DEMO_USER } from '../data/auth.js';
import { createOrder, getOrder, listMyOrders, payOrder } from '../data/orders.js';
import { listEventSessions, listEvents } from '../data/events.js';
import { getSeatMap } from '../data/seatMap.js';
import { splitOrders } from '../lib/orderView.js';
import { useAuth } from '../store/useAuth.js';

function visitor(user) {
  useAuth.setState({
    status: 'visitor',
    token: 'mock.test',
    user: {
      id: user.id,
      email: user.email,
      role: 'visitor',
      created_at: user.created_at,
    },
  });
}

function renderOrders() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/account/orders']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Свежий пользователь с одним заказом на ближайший свободный сеанс: демо-
// аккаунт общий для всех тестов файла, отмена в нём повлияла бы на соседей.
let userCounter = 0;
function visitorWithOrder({ paid }) {
  const user = {
    id: `cancel-user-${++userCounter}`,
    email: `cancel${userCounter}@example.com`,
    created_at: '2026-09-28T10:00:00Z',
  };
  for (const event of listEvents({ per_page: 200 }).data) {
    for (const session of listEventSessions(event.id)) {
      if (session.status !== 'active' || new Date(session.starts_at) <= new Date())
        continue;
      const seat = getSeatMap(session.id)
        .sections.flatMap((section) => section.seats ?? [])
        .find((s) => s.status === 'free');
      if (!seat) continue;
      const order = createOrder({
        sessionId: session.id,
        seatIds: [seat.id],
        userId: user.id,
      });
      if (paid) payOrder(order.id, { outcome: 'success' });
      visitor(user);
      return order;
    }
  }
  throw new Error('в моках не нашлось сеанса со свободным местом');
}

function orderRows() {
  return screen.queryAllByText(/^Заказ № /);
}

beforeEach(() => {
  useAuth.setState({ status: 'guest', token: null, user: null });
});

describe('OrdersPage', () => {
  it('гостя уводит на вход со строкой «Войдите, чтобы увидеть свои заказы»', () => {
    renderOrders();
    expect(screen.getByText('Войдите, чтобы увидеть свои заказы')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Мои заказы' })).not.toBeInTheDocument();
  });

  it('вкладки фильтруют список по времени сеанса', async () => {
    visitor(DEMO_USER);
    const user = userEvent.setup();
    const { upcoming, past } = splitOrders(
      listMyOrders({ userId: DEMO_USER.id, per_page: 100 }).data
    );
    renderOrders();

    const upcomingTab = await screen.findByRole('tab', { name: /Предстоящие/ });
    const pastTab = screen.getByRole('tab', { name: /Прошедшие/ });
    expect(upcomingTab).toHaveAttribute('aria-selected', 'true');
    expect(within(upcomingTab).getByText(String(upcoming.length))).toBeInTheDocument();
    expect(orderRows()).toHaveLength(upcoming.length);
    expect(screen.getByRole('heading', { name: /Завтра/ })).toBeInTheDocument();

    await user.click(pastTab);
    expect(pastTab).toHaveAttribute('aria-selected', 'true');
    expect(orderRows()).toHaveLength(past.length);
    // У прошедших заголовков групп нет.
    expect(screen.queryByRole('heading', { name: /Позже/ })).not.toBeInTheDocument();
  });

  it('показывает статусы заказов словами', async () => {
    visitor(DEMO_USER);
    renderOrders();
    expect(await screen.findByText('Ожидает оплаты')).toBeInTheDocument();
    expect(screen.getByText('Ошибка оплаты')).toBeInTheDocument();
  });

  it('без заказов — «У вас пока нет заказов» и ссылка в каталог', async () => {
    visitor({
      id: 'new-user',
      email: 'new@example.com',
      created_at: '2026-09-28T10:00:00Z',
    });
    renderOrders();
    expect(await screen.findByText('У вас пока нет заказов')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'В каталог' })).toHaveAttribute('href', '/');
  });

  it('отмена предстоящего заказа: подтверждение, статус «Отменён», кнопка пропадает', async () => {
    const order = visitorWithOrder({ paid: true });
    const user = userEvent.setup();
    renderOrders();

    await user.click(await screen.findByRole('button', { name: /^Отменить заказ «/ }));
    const dialog = screen.getByRole('dialog', { name: 'Отменить заказ?' });
    expect(within(dialog).getByText(order.session.event.title)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Отменить заказ' }));

    expect(await screen.findByText('Отменён')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Отменить заказ «/ })
    ).not.toBeInTheDocument();
    expect(getOrder(order.id).status).toBe('cancelled');
  });

  it('«Не отменять» закрывает диалог без изменений', async () => {
    const order = visitorWithOrder({ paid: false });
    const user = userEvent.setup();
    renderOrders();

    await user.click(await screen.findByRole('button', { name: /^Отменить заказ «/ }));
    await user.click(screen.getByRole('button', { name: 'Не отменять' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getOrder(order.id).status).toBe('pending');
    expect(screen.getByText('Ожидает оплаты')).toBeInTheDocument();
  });

  it('ошибку отмены показывает в диалоге', async () => {
    const order = visitorWithOrder({ paid: true });
    const user = userEvent.setup();
    renderOrders();

    await user.click(await screen.findByRole('button', { name: /^Отменить заказ «/ }));
    // Заказ успели отменить в другой вкладке.
    getOrder(order.id).status = 'cancelled';
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Отменить заказ' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Этот заказ уже нельзя отменить'
    );
  });

  it('у прошедших заказов и заказов с ошибкой оплаты кнопки нет', async () => {
    visitor(DEMO_USER);
    const user = userEvent.setup();
    renderOrders();
    await screen.findByText('Ошибка оплаты');

    const failedRow = screen.getByText('Ошибка оплаты').closest('li');
    expect(within(failedRow).queryByRole('button')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Прошедшие/ }));
    expect(
      screen.queryByRole('button', { name: /^Отменить заказ «/ })
    ).not.toBeInTheDocument();
  });
});
