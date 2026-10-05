import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../App.jsx';
import { useAuth } from '../../store/useAuth.js';
import { DEMO_ADMIN } from '../../data/auth.js';
import { VENUES } from '../../data/venues.js';
import {
  __resetHallLayouts,
  getLayout,
  listVenueLayouts,
} from '../../data/hallLayouts.js';

const STADIUM = VENUES.find((v) => v.name === 'Adrenaline Stadium');

function layoutId(name) {
  return listVenueLayouts(STADIUM.id).data.find((l) => l.name === name).id;
}

function renderEditor(name) {
  return render(
    <MemoryRouter initialEntries={[`/admin/layouts/${layoutId(name)}`]}>
      <App />
    </MemoryRouter>
  );
}

function sectorButton(name) {
  return screen.getByRole('button', { name: new RegExp(`^${name}`) });
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

describe('редактор схемы', () => {
  it('показывает сектора, зоны и итог вместимости', () => {
    renderEditor('Танцпол + трибуны');
    expect(screen.getByRole('heading', { name: 'Редактор схемы' })).toBeInTheDocument();
    expect(
      screen.getByText(/Итого: вместимость 2 648 · из них 1 800 стоячих/)
    ).toBeInTheDocument();
    expect(sectorButton('Сектор B')).toHaveTextContent('12 рядов · 360 мест');
    expect(sectorButton('Танцпол')).toHaveTextContent('стоячая · 1 800');
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeDisabled();
  });

  it('у сидячего сектора — ряды и зоны по рядам', async () => {
    const user = userEvent.setup();
    renderEditor('Танцпол + трибуны');
    await user.click(sectorButton('Сектор B'));
    expect(sectorButton('Сектор B')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: 'С местами' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByLabelText('Рядов')).toHaveValue(12);
    expect(screen.getByLabelText('Диапазон 1: ценовая зона')).toHaveDisplayValue('VIP');
    expect(screen.getByLabelText('Диапазон 2: ценовая зона')).toHaveDisplayValue(
      'Трибуна'
    );
  });

  it('у стоячей зоны — только вместимость и зона', async () => {
    const user = userEvent.setup();
    renderEditor('Танцпол + трибуны');
    await user.click(sectorButton('Танцпол'));
    expect(screen.getByRole('radio', { name: 'Стоячая зона' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByLabelText('Вместимость')).toHaveValue(1800);
    expect(screen.getByLabelText('Ценовая зона')).toHaveDisplayValue('Танцпол');
    expect(screen.queryByLabelText('Рядов')).not.toBeInTheDocument();
  });

  it('правка поля сразу пересчитывает вместимость, без запроса на сервер', async () => {
    const user = userEvent.setup();
    renderEditor('Клубная');
    const capacity = screen.getByLabelText('Вместимость');
    await user.clear(capacity);
    await user.type(capacity, '900');
    expect(sectorButton('Танцпол')).toHaveTextContent('стоячая · 900');
    expect(screen.getByText(/Итого: вместимость 900/)).toBeInTheDocument();
    expect(screen.getByText(/· черновик/)).toBeInTheDocument();
    expect(getLayout(layoutId('Клубная')).data.sections[0].capacity).toBe(1800);
  });

  it('публикация конфигурации без сеансов сохраняет её на месте', async () => {
    const user = userEvent.setup();
    renderEditor('Клубная');
    await user.click(screen.getByRole('button', { name: '+ Сектор' }));
    expect(sectorButton('Сектор 2')).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    expect(screen.getByRole('status')).toHaveTextContent('Изменения опубликованы');
    expect(getLayout(layoutId('Клубная')).data.sections).toHaveLength(2);
  });

  it('публикация конфигурации с сеансами создаёт новую версию', async () => {
    const user = userEvent.setup();
    const oldId = layoutId('Танцпол + трибуны');
    renderEditor('Танцпол + трибуны');
    await user.click(sectorButton('Сектор B'));
    await user.click(screen.getByRole('button', { name: 'Удалить сектор' }));
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    expect(await screen.findByRole('status')).toHaveTextContent('новой версией');
    expect(getLayout(oldId).data.is_archived).toBe(true);
    expect(layoutId('Танцпол + трибуны')).not.toBe(oldId);
    const list = screen.getAllByRole('list')[0];
    expect(within(list).queryByText('Сектор B')).not.toBeInTheDocument();
  });

  it('неизвестная конфигурация — сообщение и выход к площадкам', () => {
    render(
      <MemoryRouter initialEntries={['/admin/layouts/nope']}>
        <App />
      </MemoryRouter>
    );
    expect(
      screen.getByRole('heading', { name: 'Конфигурация не найдена' })
    ).toBeInTheDocument();
  });

  it('площадки ведут в редактор своих конфигураций', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/venues']}>
        <App />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('link', { name: 'Сидячий партер' }));
    expect(screen.getByText(/Adrenaline Stadium \/ Сидячий партер/)).toBeInTheDocument();
  });
});
