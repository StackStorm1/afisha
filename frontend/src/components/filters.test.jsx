import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import HomePage from '../pages/HomePage.jsx';
import { VENUES } from '../data/venues.js';
import { useFiltersStore } from '../store/useFiltersStore.js';

function nameMatcher(name) {
  return new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

function renderHome(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <HomePage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useFiltersStore.getState().resetAll();
  useFiltersStore.setState({ q: '', moreOpen: false });
});

describe('Ценовой фильтр в строке фильтров', () => {
  it('вместо кнопки «До 1500 ₽» — панель с настраиваемыми границами', () => {
    renderHome();

    expect(screen.queryByRole('button', { name: /До 1500/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Цена/ })).toBeInTheDocument();
  });

  it('введённая верхняя граница попадает в стор и в подпись чипа', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Цена/ }));
    await user.type(screen.getByLabelText('Цена до, ₽'), '2000');

    expect(useFiltersStore.getState().priceMax).toBe(2000);
    expect(screen.getByRole('button', { name: /Цена до 2\s000/ })).toBeInTheDocument();
  });

  it('пресет задаёт границу, «Сбросить цену» снимает её', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Цена/ }));
    await user.click(screen.getByRole('button', { name: /до 1\s?000/ }));
    expect(useFiltersStore.getState().priceMax).toBe(1000);

    await user.click(screen.getByRole('button', { name: 'Сбросить цену' }));
    expect(useFiltersStore.getState().priceMax).toBeNull();
  });

  it('нижняя граница не перескакивает верхнюю', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Цена/ }));
    await user.type(screen.getByLabelText('Цена до, ₽'), '800');
    await user.type(screen.getByLabelText('Цена от, ₽'), '2000');

    const { priceMin, priceMax } = useFiltersStore.getState();
    expect(priceMin).toBe(2000);
    expect(priceMax).toBe(2000);
  });

  it('Escape закрывает панель', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Цена/ }));
    expect(screen.getByLabelText('Цена до, ₽')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByLabelText('Цена до, ₽')).toBeNull();
  });

  it('старая ссылка ?price=1500 читается как верхняя граница', () => {
    renderHome('/?price=1500');

    expect(useFiltersStore.getState().priceMax).toBe(1500);
  });
});

describe('Фильтр площадки', () => {
  it('точка входа — в строке фильтров, плитки площадок в подвале страницы нет', () => {
    renderHome();

    expect(screen.getByRole('button', { name: /Площадка/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Площадки' })).toBeNull();
  });

  it('выбор площадки фильтрует каталог, чип показывает её название', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Площадка/ }));

    // Площадки без событий в список не попадают — берём первую отрисованную.
    const venue = VENUES.find(
      (v) => screen.queryAllByRole('button', { name: nameMatcher(v.name) }).length > 0
    );
    expect(venue).toBeDefined();

    await user.click(screen.getByRole('button', { name: nameMatcher(venue.name) }));

    expect(useFiltersStore.getState().venueId).toBe(venue.id);
    expect(
      screen.getByRole('button', { name: nameMatcher(venue.name) })
    ).toBeInTheDocument();
  });
});

describe('Панель «Ещё фильтры»', () => {
  it('содержит возраст, сортировку и «только в продаже»', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Ещё фильтры/ }));

    expect(screen.getByText('Возраст')).toBeInTheDocument();
    expect(screen.getByText('Сортировка')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Только в продаже/ })).toBeInTheDocument();
  });

  it('сортировка по цене переключается и попадает в стор', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole('button', { name: /Ещё фильтры/ }));
    await user.click(screen.getByRole('button', { name: 'Сначала дешёвые' }));

    expect(useFiltersStore.getState().sort).toBe('price_asc');
    expect(screen.getByRole('button', { name: /Ещё фильтры 1/ })).toBeInTheDocument();
  });
});
