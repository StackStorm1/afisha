import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App.jsx';
import { getEventBySessionId, listEvents, listEventSessions } from '../data/events.js';
import { __resetSeatMaps, getSeatMap } from '../data/seatMap.js';
import { __resetHallLayouts } from '../data/hallLayouts.js';
import { formatCount, formatPrice } from '../lib/format.js';
import { useAuth } from '../store/useAuth.js';

function activeSessions() {
  return listEvents({ per_page: 500 })
    .data.flatMap((event) => listEventSessions(event.id))
    .filter((session) => session.status === 'active');
}

function stadiumSession() {
  return activeSessions().find(
    (s) =>
      s.venue.name === 'Adrenaline Stadium' &&
      s.seats_left > 0 &&
      s.seats_left < s.total_seats
  );
}

function seatsUrl(session) {
  return `/events/${getEventBySessionId(session.id).id}/sessions/${session.id}/seats`;
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

function scheme() {
  return screen.getByRole('img', { name: /^Схема зала/ });
}

function sectionNode(name) {
  return [...scheme().querySelectorAll('[data-kind]')].find(
    (node) => node.querySelector('text').textContent === name
  );
}

beforeEach(() => {
  __resetHallLayouts();
  __resetSeatMaps();
  useAuth.setState({ status: 'guest', token: null, user: null });
});

describe('схема зала посетителя', () => {
  it('гость видит схему без входа: шапка, легенда зон, сектора, сцена', async () => {
    const session = stadiumSession();
    const event = getEventBySessionId(session.id);
    renderAt(seatsUrl(session));

    expect(await screen.findByRole('heading', { name: event.title })).toBeInTheDocument();
    expect(
      screen.getByText(
        `${event.category.name} · ${event.age_rating} · Adrenaline Stadium`
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /К событию/ })).toHaveAttribute(
      'href',
      `/events/${event.id}`
    );

    const seatMap = getSeatMap(session.id);
    const legend = await screen.findByRole('group', { name: 'Ценовые зоны' });
    const zones = within(legend).getAllByRole('button');
    expect(zones.map((chip) => chip.firstChild.nextSibling.textContent)).toEqual([
      'VIP',
      'Трибуна',
      'Танцпол',
      'Балкон',
    ]);
    const vip = seatMap.price_zones[0];
    expect(zones[0]).toHaveTextContent(formatPrice(vip.price));
    expect(zones[0]).toHaveTextContent(
      vip.available ? `осталось ${formatCount(vip.available)}` : 'продано'
    );

    expect(within(scheme()).getByText('СЦЕНА')).toBeInTheDocument();
    const dance = sectionNode('Танцпол');
    expect(dance).toHaveAttribute('data-kind', 'standing');
    expect(dance).toHaveTextContent('Без мест · выберите количество');
    expect(sectionNode('Сектор B')).toHaveAttribute('data-kind', 'seated');
  });

  it('места трёх состояний: число занятых и свободных совпадает со схемой сеанса', async () => {
    const session = stadiumSession();
    renderAt(seatsUrl(session));
    await screen.findByRole('img', { name: /^Схема зала/ });

    const seats = getSeatMap(session.id).sections.flatMap((s) => s.seats ?? []);
    const free = seats.filter((s) => s.status === 'free').length;
    expect(scheme().querySelectorAll('[data-state="free"]')).toHaveLength(free);
    expect(scheme().querySelectorAll('[data-state="taken"]')).toHaveLength(
      seats.length - free
    );
    // Занятое отличается не только цветом: у него крестик.
    const taken = scheme().querySelector('[data-state="taken"]');
    expect(taken.querySelector('path')).not.toBeNull();
    // Системной подсказки браузера нет: рядом с подсказкой схемы их было бы две.
    expect(taken.querySelector('title')).toBeNull();
  });

  it('клик по зоне в легенде подсвечивает её, повторный снимает', async () => {
    const user = userEvent.setup();
    renderAt(seatsUrl(stadiumSession()));
    const legend = await screen.findByRole('group', { name: 'Ценовые зоны' });
    const dance = within(legend).getByRole('button', { name: /^Танцпол/ });

    await user.click(dance);
    expect(dance).toHaveAttribute('aria-pressed', 'true');
    expect(sectionNode('Танцпол')).toHaveAttribute('data-dimmed', 'false');
    expect(sectionNode('Сектор A')).toHaveAttribute('data-dimmed', 'true');

    const vip = within(legend).getByRole('button', { name: /^VIP/ });
    await user.click(vip);
    expect(dance).toHaveAttribute('aria-pressed', 'false');
    // В секторе B две зоны: сектор не приглушён, приглушены места трибуны.
    const sectorB = sectionNode('Сектор B');
    expect(sectorB).toHaveAttribute('data-dimmed', 'false');
    expect(sectorB.querySelectorAll('[data-dimmed="true"]').length).toBeGreaterThan(0);

    await user.click(vip);
    expect(scheme().querySelectorAll('[data-dimmed="true"]')).toHaveLength(0);
  });

  it('выбор сеанса открывает схему другого сеанса', async () => {
    const user = userEvent.setup();
    const event = listEvents({ per_page: 500 }).data.find(
      (e) => listEventSessions(e.id).filter((s) => s.status === 'active').length > 1
    );
    const [first, second] = listEventSessions(event.id).filter(
      (s) => s.status === 'active'
    );
    renderAt(seatsUrl(first));

    const select = await screen.findByRole('combobox', { name: 'Сеанс' });
    expect(select).toHaveValue(first.id);
    await user.selectOptions(select, second.id);
    expect(screen.getByRole('combobox', { name: 'Сеанс' })).toHaveValue(second.id);
  });

  it('список секторов: остаток, цена «от» у сектора с несколькими зонами', async () => {
    const session = stadiumSession();
    renderAt(seatsUrl(session));
    const list = await screen.findByRole('region', { name: 'Сектора' });
    const rows = within(list).getAllByRole('button');
    expect(
      rows.map((row) => row.querySelector('span + span > span').textContent)
    ).toEqual(['Танцпол', 'Сектор A', 'Сектор B', 'Сектор C']);
    expect(rows[0]).toHaveTextContent(/без мест · (осталось|продано)/);
    expect(rows[2]).toHaveTextContent(/от \d/);
  });

  it('несуществующий сеанс и сеанс чужого события — «Сеанс не найден»', () => {
    const session = stadiumSession();
    const other = listEvents({ per_page: 500 }).data.find(
      (e) => e.id !== getEventBySessionId(session.id).id
    );
    renderAt(`/events/${other.id}/sessions/${session.id}/seats`);
    expect(screen.getByRole('heading', { name: 'Сеанс не найден' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'К событию' })).toHaveAttribute(
      'href',
      `/events/${other.id}`
    );
  });

  it('кнопка сеанса на странице события ведёт гостя на схему, а не на вход', async () => {
    const user = userEvent.setup();
    const session = stadiumSession();
    const event = getEventBySessionId(session.id);
    renderAt(`/events/${event.id}`);
    const buttons = screen.getAllByRole('link', { name: 'Выбрать места' });
    const toSession = buttons.find(
      (link) => link.getAttribute('href') === seatsUrl(session)
    );
    expect(toSession).toBeDefined();
    await user.click(toSession);
    expect(await screen.findByRole('img', { name: /^Схема зала/ })).toBeInTheDocument();
  });
});
