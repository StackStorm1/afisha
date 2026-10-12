import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { getEventBySessionId, listEvents, listEventSessions } from '../data/events.js';
import {
  __resetSeatMaps,
  freeStandingUnits,
  getSeatMap,
  setUnitsStatus,
} from '../data/seatMap.js';
import { __resetHallLayouts } from '../data/hallLayouts.js';
import { register } from '../data/auth.js';
import { createOrder, expireStaleOrders } from '../data/orders.js';
import { useAuth } from '../store/useAuth.js';
import { useSeatSelection } from '../store/useSeatSelection.js';

const EMAIL = 'seats@example.com';
const PASSWORD = 's3cr3tPass';

function futureSession(venueName) {
  const now = new Date();
  return listEvents({ per_page: 500 })
    .data.flatMap((event) => listEventSessions(event.id))
    .find(
      (s) =>
        s.status === 'active' &&
        s.venue.name === venueName &&
        new Date(s.starts_at) > now &&
        s.seats_left > 20 &&
        s.seats_left < s.total_seats
    );
}

function renderSeats(session) {
  const event = getEventBySessionId(session.id);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/events/${event.id}/sessions/${session.id}/seats`]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function scheme() {
  return screen.findByRole('img', { name: /^Схема зала/ });
}

function sectionNode(svg, name) {
  return [...svg.querySelectorAll('[data-section-id]')].find(
    (node) => node.querySelector('text').textContent === name
  );
}

function freeSeatIds(session, sectionName, count) {
  const section = getSeatMap(session.id).sections.find((s) => s.name === sectionName);
  return section.seats
    .filter((seat) => seat.status === 'free')
    .slice(0, count)
    .map((seat) => seat.id);
}

function seatNode(svg, id) {
  return svg.querySelector(`[data-seat-id="${id}"]`);
}

beforeEach(async () => {
  window.localStorage.clear();
  __resetHallLayouts();
  __resetSeatMaps();
  useSeatSelection.setState({ bySession: {} });
  useAuth.setState({ status: 'guest', token: null, user: null });
  await register({ email: EMAIL, password: PASSWORD }).catch(() => {});
});

describe('выбор мест на схеме', () => {
  it('клик по свободному месту выбирает его, сумма и состав в нижней панели', async () => {
    const user = userEvent.setup();
    const session = futureSession('Большой театр');
    renderSeats(session);
    const svg = await scheme();
    expect(
      screen.getByText('Выберите места на схеме или количество в стоячей зоне')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Забронировать' })).toBeDisabled();

    const [first, second] = freeSeatIds(session, 'Зал', 2);
    await user.click(seatNode(svg, first));
    expect(seatNode(svg, first)).toHaveAttribute('data-state', 'selected');
    await user.click(seatNode(svg, second));

    const lines = within(
      screen.getByRole('list', { name: 'Выбранные билеты' })
    ).getAllByRole('listitem');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent(/^Зал, ряд \S+, место \d+/);
    expect(screen.getByText('2 билета')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Забронировать' })).toBeEnabled();

    // Повторный клик снимает выбор, ✕ в пилюле — тоже.
    await user.click(seatNode(svg, first));
    expect(seatNode(svg, first)).toHaveAttribute('data-state', 'free');
    await user.click(screen.getByRole('button', { name: /^Убрать: Зал/ }));
    expect(screen.getByRole('button', { name: 'Забронировать' })).toBeDisabled();
  });

  it('стоячая зона: панель со степпером и быстрым выбором, «Готово» закрывает', async () => {
    const user = userEvent.setup();
    renderSeats(futureSession('Adrenaline Stadium'));
    const svg = await scheme();

    await user.click(sectionNode(svg, 'Танцпол').querySelector('polygon'));
    const panel = screen.getByRole('dialog', { name: 'Танцпол' });
    expect(panel).toHaveFocus();
    expect(within(panel).getByText('Стоячая зона')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Меньше' })).toBeDisabled();

    await user.click(within(panel).getByRole('button', { name: 'Больше' }));
    await user.click(within(panel).getByRole('button', { name: '4' }));
    expect(within(panel).getByRole('button', { name: '4' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      within(panel).getByText('Не больше 10 билетов в заказе.', { exact: false })
    ).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Готово' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/^Танцпол × 4/)).toBeInTheDocument();
    expect(sectionNode(svg, 'Танцпол')).toHaveTextContent('4 в заказе');
  });

  it('одиннадцатый билет не выбрать ни местом, ни степпером, об этом сказано', async () => {
    const user = userEvent.setup();
    const session = futureSession('Adrenaline Stadium');
    renderSeats(session);
    const svg = await scheme();

    await user.click(sectionNode(svg, 'Танцпол').querySelector('polygon'));
    const panel = screen.getByRole('dialog', { name: 'Танцпол' });
    await user.click(within(panel).getByRole('button', { name: '6' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const seats = freeSeatIds(session, 'Сектор B', 5);
    for (const id of seats.slice(0, 4)) await user.click(seatNode(svg, id));
    expect(screen.getByText('10 билетов')).toBeInTheDocument();
    expect(screen.getByText('Максимум 10 билетов')).toBeInTheDocument();

    await user.click(seatNode(svg, seats[4]));
    expect(seatNode(svg, seats[4])).toHaveAttribute('data-state', 'free');
    expect(screen.getByText('Больше 10 билетов в один заказ нельзя')).toBeInTheDocument();

    await user.click(sectionNode(svg, 'Танцпол').querySelector('polygon'));
    const again = screen.getByRole('dialog', { name: 'Танцпол' });
    expect(within(again).getByRole('button', { name: 'Больше' })).toBeDisabled();
    expect(within(again).getByText(/больше нельзя/)).toBeInTheDocument();
  });

  it('«Выбор без схемы»: сектор → ряд → место кнопками, тот же выбор', async () => {
    const user = userEvent.setup();
    const session = futureSession('Adrenaline Stadium');
    renderSeats(session);
    await scheme();

    await user.click(screen.getByRole('button', { name: 'Списком' }));
    const picker = screen.getByRole('region', { name: 'Выбор без схемы' });
    const sectors = within(picker).getByRole('group', { name: 'Сектор' });
    await user.click(within(sectors).getByRole('button', { name: /^Сектор A/ }));
    const rows = within(picker).getByRole('group', { name: 'Сектор A, ряд' });
    const openRow = within(rows)
      .getAllByRole('button')
      .find((b) => !b.disabled);
    await user.click(openRow);

    const seatGroup = within(picker).getByRole('group', { name: /^Сектор A · ряд/ });
    const seat = within(seatGroup).getAllByRole('button', { name: /свободно$/ })[0];
    await user.click(seat);
    expect(seat).toHaveAttribute('aria-pressed', 'true');
    expect(seat).toHaveAccessibleName(/^Место \d+, выбрано$/);
    expect(screen.getByText('1 билет')).toBeInTheDocument();

    // Стоячая зона из списка открывает свою панель.
    await user.click(within(sectors).getByRole('button', { name: /^Танцпол/ }));
    expect(screen.getByRole('dialog', { name: 'Танцпол' })).toBeInTheDocument();
  });

  it('сектор с мелкими местами открывается крупно, «← Весь зал» возвращает', async () => {
    const user = userEvent.setup();
    renderSeats(futureSession('Adrenaline Stadium'));
    const svg = await scheme();

    // В секторе A места мельче порога — клик по месту не выбирает его.
    expect(sectionNode(svg, 'Сектор A').querySelector('[data-seat-id]')).toBeNull();
    await user.click(sectionNode(svg, 'Сектор A').querySelector('polygon'));

    expect(screen.getByRole('heading', { name: 'Сектор A' })).toBeInTheDocument();
    const back = screen.getByText('Весь зал').closest('button');
    expect(back).toHaveFocus();
    // Мест в секторе сотни: ищем селектором, а не по роли — так в разы быстрее.
    const seats = screen.getByRole('group', { name: 'Сектор A, места' });
    const seat = seats.querySelector('[data-state="free"]');
    expect(seat).toHaveAccessibleName(/^Ряд \S+, место \d+, свободно — /);
    await user.click(seat);
    expect(seat).toHaveAttribute('aria-pressed', 'true');

    const zoomIn = screen.getByLabelText('Увеличить');
    await user.click(zoomIn);
    expect(zoomIn).toBeDisabled();

    await user.click(back);
    expect(await scheme()).toBeInTheDocument();
    expect(screen.getByText('1 билет')).toBeInTheDocument();
  });
});

describe('бронирование', () => {
  it('гость: «Забронировать» ведёт на вход, после входа выбор на месте и бронь создаётся', async () => {
    const user = userEvent.setup();
    const session = futureSession('Большой театр');
    renderSeats(session);
    const svg = await scheme();
    const [seatId] = freeSeatIds(session, 'Зал', 1);
    await user.click(seatNode(svg, seatId));

    await user.click(screen.getByRole('button', { name: 'Забронировать' }));
    expect(screen.getByText('Войдите, чтобы забронировать места')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), EMAIL);
    await user.type(screen.getByLabelText('Пароль'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    await scheme();
    expect(await screen.findByText('1 билет')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    // Бронь создана — сразу оформление заказа с таймером удержания.
    expect(
      await screen.findByRole('heading', { name: 'Оформление заказа' })
    ).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/^1[45]:\d\d$/);
    const held = getSeatMap(session.id, {
      userId: useAuth.getState().user.id,
    }).sections[0].seats.find((s) => s.id === seatId);
    expect(held).toMatchObject({ status: 'held', held_by_me: true });

    // На схеме своё место выбранное, выбор для новой брони пуст, рядом с
    // таймером — путь обратно к оплате.
    await user.click(screen.getByRole('link', { name: /К схеме зала/ }));
    await scheme();
    expect(
      screen.getByText('Выберите места на схеме или количество в стоячей зоне')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'К оплате →' })).toBeInTheDocument();
  });
});

// Свой id на тест: заказы в моке живут весь файл, и чужая бронь на тот же
// сеанс попала бы в таймер соседнего теста.
function asVisitor(id = 'conflict-user') {
  useAuth.setState({
    status: 'visitor',
    token: 'mock.token',
    user: {
      id,
      email: 'conflict@example.com',
      role: 'visitor',
      created_at: '2026-10-01T10:00:00Z',
    },
  });
}

describe('конфликты брони', () => {
  it('место заняли: оно уходит из выбора, плашка, остальной выбор на месте', async () => {
    const user = userEvent.setup();
    asVisitor();
    const session = futureSession('Большой театр');
    renderSeats(session);
    const svg = await scheme();
    const [lostId, keptId] = freeSeatIds(session, 'Зал', 2);
    await user.click(seatNode(svg, lostId));
    await user.click(seatNode(svg, keptId));

    // Пока человек выбирал, первое место купил кто-то другой.
    setUnitsStatus(session.id, [lostId], 'held', 'someone-else');
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      /^✕Зал, ряд \S+, место \d+ только что заняли\. Остальные места остаются за вами\./
    );
    expect(svg.querySelector('[data-lost="true"]')).not.toBeNull();
    expect(screen.getByText('1 билет')).toBeInTheDocument();
    expect(seatNode(svg, keptId)).toHaveAttribute('data-state', 'selected');

    await user.click(within(alert).getByRole('button', { name: 'Понятно' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Забронировать' }));
    expect(await screen.findByRole('timer')).toBeInTheDocument();
  });

  it('в зоне не хватило: панель с остатком и «Взять N», количество само не меняется', async () => {
    const user = userEvent.setup();
    asVisitor();
    const session = futureSession('Adrenaline Stadium');
    renderSeats(session);
    const svg = await scheme();

    await user.click(sectionNode(svg, 'Танцпол').querySelector('polygon'));
    let panel = screen.getByRole('dialog', { name: 'Танцпол' });
    await user.click(within(panel).getByRole('button', { name: '4' }));
    await user.click(within(panel).getByRole('button', { name: 'Больше' }));
    await user.click(within(panel).getByRole('button', { name: 'Готово' }));

    // В зоне остаётся 3 свободных билета.
    const dance = getSeatMap(session.id).sections.find((s) => s.name === 'Танцпол');
    const free = freeStandingUnits(session.id, dance.id);
    setUnitsStatus(session.id, free.slice(3), 'held', 'someone-else');
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    panel = await screen.findByRole('dialog', { name: 'Танцпол' });
    expect(within(panel).getByRole('alert')).toHaveTextContent(
      'Пока вы выбирали, осталось 3 билета. Выбрано 5.'
    );
    expect(screen.getByText(/^Танцпол × 5/)).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Взять 3' }));
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/^Танцпол × 3/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Забронировать' }));
    expect(await screen.findByRole('timer')).toBeInTheDocument();
  });
});

describe('удержание брони', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('таймер идёт по expires_at, по истечении места не свои и сказано текстом', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    asVisitor('timer-user');
    const session = futureSession('Большой театр');
    const [seatId] = freeSeatIds(session, 'Зал', 1);
    createOrder({ sessionId: session.id, seatIds: [seatId], userId: 'timer-user' });

    renderSeats(session);
    const svg = await scheme();
    const timer = await screen.findByRole('timer');
    expect(timer).toHaveTextContent(/^1[45]:\d\d$/);
    // Своё удержанное место — выбранное, но не в выборе для новой брони.
    expect(svg.querySelector(`[data-state="selected"]`)).not.toBeNull();
    expect(screen.getByText(/^Билет удержан ещё/)).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(14 * 60 * 1000 + 30 * 1000);
    expect(screen.getByRole('timer')).toHaveTextContent(/^0:[23]\d$/);
    expect(screen.getByText('До конца брони осталась минута')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(40 * 1000);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Время брони истекло, места освобождены. Выберите места заново.'
    );
    // До фоновой очистки место занятое, а не своё.
    await vi.advanceTimersByTimeAsync(0);
    expect(svg.querySelector(`[data-state="selected"]`)).toBeNull();

    // Фоновая задача освободила место — оно снова свободно на схеме.
    expireStaleOrders();
    expect(
      getSeatMap(session.id).sections[0].seats.find((s) => s.id === seatId).status
    ).toBe('free');
  });
});
