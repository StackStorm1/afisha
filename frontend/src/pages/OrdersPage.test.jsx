import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App.jsx';
import { DEMO_USER } from '../data/auth.js';
import { listMyOrders } from '../data/orders.js';
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
});
