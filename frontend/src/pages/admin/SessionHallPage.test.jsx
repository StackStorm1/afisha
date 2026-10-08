import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../App.jsx';
import { useAuth } from '../../store/useAuth.js';
import { DEMO_ADMIN } from '../../data/auth.js';
import { listEvents, listEventSessions } from '../../data/events.js';
import {
  __resetHallLayouts,
  getLayout,
  getSessionHall,
  listVenueLayouts,
  saveLayoutRevision,
} from '../../data/hallLayouts.js';

function stadiumSessions() {
  return listEvents({ per_page: 500 })
    .data.flatMap((event) => listEventSessions(event.id))
    .filter((session) => session.venue.name === 'Adrenaline Stadium');
}

function stadiumSession({ sold }) {
  return stadiumSessions().find(
    (session) => getSessionHall(session.id).data.sold_count > 0 === sold
  );
}

function renderHall(sessionId) {
  return render(
    <MemoryRouter initialEntries={[`/admin/events/sessions/${sessionId}/hall`]}>
      <App />
    </MemoryRouter>
  );
}

function card(name) {
  return screen.getByRole('radio', { name: new RegExp(`^${name}`) });
}

function zoneNames() {
  const prices = screen.getByRole('region', { name: /Цены по зонам/ });
  return within(prices)
    .getAllByRole('textbox')
    .map((input) => input.labels[0].textContent);
}

beforeEach(() => {
  __resetHallLayouts();
  useAuth.setState({
    status: 'visitor',
    token: 'mock.token',
    user: {
      id: DEMO_ADMIN.id,
      email: DEMO_ADMIN.email,
      role: 'admin',
      created_at: DEMO_ADMIN.created_at,
    },
  });
});

describe('схема зала для сеанса', () => {
  it('5a: три конфигурации стадиона, выбрана первая, цены по её зонам', () => {
    renderHall(stadiumSession({ sold: false }).id);
    expect(
      screen.getByRole('heading', { name: 'Схема зала для сеанса' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Площадка: Adrenaline Stadium/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(card('Танцпол \\+ трибуны')).toHaveAttribute('aria-checked', 'true');
    expect(card('Танцпол \\+ трибуны')).toHaveTextContent('✓ Выбрана');
    expect(card('Танцпол \\+ трибуны')).toHaveTextContent(
      'Вместимость 2 648' + '4 сектора · 4 зоны'
    );
    expect(zoneNames()).toEqual(['VIP', 'Трибуна', 'Танцпол', 'Балкон']);
    expect(screen.getByText('1 800 без мест')).toBeInTheDocument();
    expect(screen.getByText('49 мест')).toBeInTheDocument();
    expect(screen.getByLabelText('VIP')).not.toHaveValue('');
    const nav = screen.getByRole('navigation', { name: 'Разделы админки' });
    expect(within(nav).getByRole('link', { name: 'События' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('стрелки переключают конфигурацию, цены совпадающих зон сохраняются', async () => {
    const user = userEvent.setup();
    renderHall(stadiumSession({ sold: false }).id);
    const dance = screen.getByLabelText('Танцпол');
    await user.clear(dance);
    await user.type(dance, '2 700');

    card('Танцпол \\+ трибуны').focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(card('Клубная')).toHaveAttribute('aria-checked', 'true');
    expect(card('Клубная')).toHaveFocus();
    expect(card('Клубная')).toHaveAttribute('tabindex', '0');
    expect(card('Сидячий партер')).toHaveAttribute('tabindex', '-1');
    expect(zoneNames()).toEqual(['Танцпол']);
    expect(screen.getByLabelText('Танцпол')).toHaveValue('2 700');

    // По кругу: с последней на первую.
    await user.keyboard('{ArrowDown}');
    expect(card('Танцпол \\+ трибуны')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(card('Клубная')).toHaveAttribute('aria-checked', 'true');
  });

  it('без цены у любой зоны сохранить нельзя: ошибка под полем и фокус в нём', async () => {
    const user = userEvent.setup();
    const session = stadiumSession({ sold: false });
    renderHall(session.id);
    await user.click(card('Сидячий партер'));
    const before = getSessionHall(session.id).data;
    const save = screen.getByRole('button', { name: 'Сохранить' });

    // У «Партера» цены ещё нет: такой зоны не было в прежней конфигурации.
    const stalls = screen.getByLabelText('Партер');
    expect(stalls).toHaveValue('');
    expect(screen.getByLabelText('Трибуна')).not.toHaveValue('');
    await user.click(save);
    expect(stalls).toHaveFocus();
    expect(stalls).toHaveAccessibleDescription('Укажите цену');
    await user.type(stalls, '4500');

    const tribune = screen.getByLabelText('Трибуна');
    await user.clear(tribune);
    await user.click(save);

    expect(tribune).toHaveFocus();
    expect(tribune).toHaveAttribute('aria-invalid', 'true');
    expect(tribune).toHaveAccessibleDescription('Укажите цену');
    expect(getSessionHall(session.id).data).toEqual(before);

    await user.type(tribune, '12,5x');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(tribune).toHaveAccessibleDescription('Цена в рублях, например 2500');

    await user.clear(tribune);
    await user.type(tribune, '3 500');
    expect(tribune).toHaveAttribute('aria-invalid', 'false');
  });

  it('сохраняет конфигурацию и цены сеанса', async () => {
    const user = userEvent.setup();
    const session = stadiumSession({ sold: false });
    renderHall(session.id);
    await user.click(card('Клубная'));
    const dance = screen.getByLabelText('Танцпол');
    await user.clear(dance);
    await user.type(dance, '2 500');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByRole('status')).toHaveTextContent('Сохранено: «Клубная»');
    const hall = getSessionHall(session.id).data;
    const club = listVenueLayouts(session.venue.id).data.find(
      (l) => l.name === 'Клубная'
    );
    expect(hall.layout_id).toBe(club.id);
    expect(hall.prices).toEqual([
      { price_zone_id: getLayout(club.id).data.price_zones[0].id, price: '2500.00' },
    ]);
  });

  it('«Открыть в редакторе» ведёт в редактор выбранной конфигурации', async () => {
    const user = userEvent.setup();
    renderHall(stadiumSession({ sold: false }).id);
    await user.click(card('Сидячий партер'));
    await user.click(screen.getByRole('link', { name: 'Открыть в редакторе' }));
    expect(screen.getByRole('heading', { name: 'Редактор схемы' })).toBeInTheDocument();
    expect(screen.getByText(/Adrenaline Stadium \/ Сидячий партер/)).toBeInTheDocument();
  });

  it('5b: при продажах другие конфигурации, цены и «Сохранить» заблокированы', async () => {
    const user = userEvent.setup();
    const session = stadiumSession({ sold: true });
    const sold = getSessionHall(session.id).data.sold_count;
    renderHall(session.id);

    expect(screen.getByText(/На сеанс уже продан/)).toHaveTextContent(
      'пока на сеанс есть заказы'
    );
    expect(card('Сидячий партер')).toBeDisabled();
    expect(card('Клубная')).toBeDisabled();
    expect(card('Клубная')).toHaveTextContent(
      new RegExp(`Недоступно: продан.* ${sold} `)
    );
    expect(card('Танцпол \\+ трибуны')).toBeEnabled();
    expect(screen.getByLabelText('VIP')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();

    card('Танцпол \\+ трибуны').focus();
    await user.keyboard('{ArrowRight}');
    expect(card('Танцпол \\+ трибуны')).toHaveAttribute('aria-checked', 'true');
  });

  it('сеанс на архивной версии видит её карточку, редактор для неё не предлагается', async () => {
    const session = stadiumSession({ sold: true });
    const oldId = getSessionHall(session.id).data.layout_id;
    const old = getLayout(oldId).data;
    saveLayoutRevision(oldId, { ...old, name: 'Новая версия' });
    renderHall(session.id);

    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(card('Танцпол \\+ трибуны')).toHaveAttribute('aria-checked', 'true');
    expect(card('Танцпол \\+ трибуны')).toHaveTextContent(
      'Прежняя версия схемы, в архиве'
    );
    expect(
      screen.queryByRole('link', { name: 'Открыть в редакторе' })
    ).not.toBeInTheDocument();
  });

  it('неизвестный сеанс — сообщение и ссылка к событиям', () => {
    renderHall('00000000-0000-4000-8000-000000000000');
    expect(screen.getByRole('heading', { name: 'Сеанс не найден' })).toBeInTheDocument();
  });
});
