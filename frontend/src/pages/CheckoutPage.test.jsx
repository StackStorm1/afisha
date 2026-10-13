import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { listEventSessions, listEvents } from '../data/events.js';
import { __resetSeatMaps, freeStandingUnits, getSeatMap } from '../data/seatMap.js';
import { __resetHallLayouts } from '../data/hallLayouts.js';
import { createOrder, getOrder } from '../data/orders.js';
import { formatPrice } from '../lib/format.js';
import { useAuth } from '../store/useAuth.js';

// Свой пользователь на тест: заказы мока живут весь файл.
let userCounter = 0;
function asVisitor() {
  const id = `checkout-user-${++userCounter}`;
  useAuth.setState({
    status: 'visitor',
    token: 'mock.token',
    user: {
      id,
      email: `checkout${userCounter}@example.com`,
      role: 'visitor',
      created_at: '2026-10-01T10:00:00Z',
    },
  });
  return id;
}

function futureSession(venueName) {
  const now = new Date();
  return listEvents({ per_page: 500 })
    .data.flatMap((event) => listEventSessions(event.id))
    .find(
      (s) =>
        s.status === 'active' &&
        s.venue.name === venueName &&
        new Date(s.starts_at) > now &&
        s.seats_left > 20
    );
}

function freeSeatIds(session, count) {
  return getSeatMap(session.id)
    .sections.flatMap((section) => section.seats ?? [])
    .filter((seat) => seat.status === 'free')
    .slice(0, count)
    .map((seat) => seat.id);
}

function bookSeats(userId, count = 2) {
  const session = futureSession('Большой театр');
  return createOrder({
    sessionId: session.id,
    seatIds: freeSeatIds(session, count),
    userId,
  });
}

function renderAt(path) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function checkout() {
  return screen.findByRole('heading', { name: 'Оформление заказа' });
}

beforeEach(() => {
  window.localStorage.clear();
  __resetHallLayouts();
  __resetSeatMaps();
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

describe('оформление заказа', () => {
  it('сводка: событие, места, точная сумма без сборов, таймер', async () => {
    const userId = asVisitor();
    const order = bookSeats(userId, 2);
    renderAt(`/checkout/${order.id}`);
    await checkout();

    expect(
      screen.getByRole('heading', { name: order.session.event.title })
    ).toBeInTheDocument();
    expect(screen.getByText('2 билета')).toBeInTheDocument();
    const lines = screen.getAllByRole('listitem');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent(
      `${order.seats[0].section.name} · Ряд ${order.seats[0].row_label}, место ${order.seats[0].seat_label}`
    );
    expect(screen.getByText(formatPrice(order.total_price))).toBeInTheDocument();
    expect(screen.queryByText(/сбор|комисси/i)).not.toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/^1[45]:\d\d$/);
  });

  it('стоячая зона — одной строкой с количеством', async () => {
    const userId = asVisitor();
    const session = futureSession('Adrenaline Stadium');
    const dance = getSeatMap(session.id).sections.find((s) => s.kind === 'standing');
    expect(freeStandingUnits(session.id, dance.id).length).toBeGreaterThan(3);
    const order = createOrder({
      sessionId: session.id,
      standing: [{ section_id: dance.id, quantity: 3 }],
      userId,
    });
    renderAt(`/checkout/${order.id}`);
    await checkout();
    const [line] = screen.getAllByRole('listitem');
    expect(line).toHaveTextContent(`${dance.name} × 3`);
  });

  it('успех: заказ оплачен, переход в «Мои заказы» с подтверждением', async () => {
    const user = userEvent.setup();
    const userId = asVisitor();
    const order = bookSeats(userId);
    renderAt(`/checkout/${order.id}`);
    await checkout();

    await user.click(screen.getByRole('button', { name: 'Оплатить' }));
    expect(
      await screen.findByRole('heading', { name: 'Мои заказы' })
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^✓Оплата прошла\./);
    expect(getOrder(order.id).status).toBe('paid');
    const row = document.querySelector(`[data-order-id="${order.id}"]`);
    expect(within(row).getByText('Оплачен')).toBeInTheDocument();
  });

  it('отказ шлюза: бронь сохраняется, повтор оплаты проходит', async () => {
    const user = userEvent.setup();
    const userId = asVisitor();
    const order = bookSeats(userId);
    // Исход тестового шлюза в моке задаётся адресом страницы.
    window.history.replaceState(null, '', '/?pay=decline');
    renderAt(`/checkout/${order.id}`);
    await checkout();

    await user.click(screen.getByRole('button', { name: 'Оплатить' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Оплата не прошла');
    expect(alert).toHaveTextContent('Места остаются за вами');
    expect(alert).toHaveFocus();
    expect(getOrder(order.id).status).toBe('failed');
    // Места не отпущены: по-прежнему удержаны этим посетителем.
    const seat = getSeatMap(order.session.id, { userId })
      .sections.flatMap((section) => section.seats ?? [])
      .find((s) => s.id === order.seats[0].id);
    expect(seat).toMatchObject({ status: 'held', held_by_me: true });
    expect(screen.getByRole('timer')).toBeInTheDocument();

    window.history.replaceState(null, '', '/?pay=success');
    await user.click(screen.getByRole('button', { name: 'Повторить оплату' }));
    expect(
      await screen.findByRole('heading', { name: 'Мои заказы' })
    ).toBeInTheDocument();
    expect(getOrder(order.id).status).toBe('paid');
  });

  it('бронь истекла к оплате: назад на схему зала с сообщением', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const userId = asVisitor();
    const order = bookSeats(userId, 1);
    renderAt(`/checkout/${order.id}`);
    await checkout();

    // Нажать «Оплатить» в последнюю секунду: таймер ещё идёт, а на сервере
    // срок уже вышел — 409 BOOKING_EXPIRED.
    order.expires_at = new Date(Date.now() - 1000).toISOString();
    await user.click(screen.getByRole('button', { name: 'Оплатить' }));

    expect(await screen.findByRole('img', { name: /^Схема зала/ })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Время брони истекло, места освобождены. Выберите места заново.'
    );
    expect(getOrder(order.id).status).toBe('cancelled');
  });

  it('таймер дошёл до нуля на оформлении — тоже назад на схему', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const userId = asVisitor();
    const order = bookSeats(userId, 1);
    renderAt(`/checkout/${order.id}`);
    await checkout();

    await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1000);
    expect(await screen.findByRole('img', { name: /^Схема зала/ })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Время брони истекло');
    // До фоновой очистки место не своё и не в выборе.
    const svg = screen.getByRole('img', { name: /^Схема зала/ });
    expect(svg.querySelector('[data-state="selected"]')).toBeNull();
  });

  it('чужой или несуществующий заказ — «Заказ не найден»', async () => {
    const order = bookSeats(asVisitor());
    asVisitor();
    renderAt(`/checkout/${order.id}`);
    expect(
      await screen.findByRole('heading', { name: 'Заказ не найден' })
    ).toBeInTheDocument();
  });

  it('оплаченный заказ формы оплаты не показывает', async () => {
    const user = userEvent.setup();
    const userId = asVisitor();
    const order = bookSeats(userId);
    const { unmount } = renderAt(`/checkout/${order.id}`);
    await checkout();
    await user.click(screen.getByRole('button', { name: 'Оплатить' }));
    await screen.findByRole('heading', { name: 'Мои заказы' });
    unmount();

    renderAt(`/checkout/${order.id}`);
    expect(
      await screen.findByRole('heading', { name: 'Заказ оплачен' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Оплатить' })).not.toBeInTheDocument();
  });

  it('гостя ведёт на вход с объяснением', async () => {
    useAuth.setState({ status: 'guest', token: null, user: null });
    renderAt('/checkout/00000000-0000-0000-0000-000000000000');
    expect(await screen.findByText('Войдите, чтобы оплатить заказ')).toBeInTheDocument();
  });

  it('«Мои заказы»: у неоплаченной брони ссылка на оплату', async () => {
    const userId = asVisitor();
    const order = bookSeats(userId);
    renderAt('/account/orders');
    const link = await screen.findByRole('link', { name: /^Оплатить заказ/ });
    expect(link).toHaveAttribute('href', `/checkout/${order.id}`);
  });
});
