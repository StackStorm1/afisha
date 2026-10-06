import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App.jsx';
import { useAuth } from '../../store/useAuth.js';
import { DEMO_ADMIN } from '../../data/auth.js';
import { VENUES } from '../../data/venues.js';
import {
  __resetHallLayouts,
  getLayout,
  listVenueLayouts,
} from '../../data/hallLayouts.js';
import { shapeRect } from '../../lib/hallLayout.js';

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

// В jsdom нет PointerEvent, и без него события холста приходят без
// координат. Для тестов хватает MouseEvent с pointerId.
if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  };
}

// Холст 840 × 640 занимает блок того же размера: экранные координаты
// совпадают с координатами холста.
function canvasSvg() {
  const svg = screen.getByRole('application').querySelector('svg');
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 840,
    height: 640,
  });
  return svg;
}

function drag(target, svg, from, to) {
  fireEvent.pointerDown(target, {
    button: 0,
    pointerId: 1,
    clientX: from[0],
    clientY: from[1],
  });
  fireEvent.pointerMove(svg, { pointerId: 1, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(svg, { pointerId: 1, clientX: to[0], clientY: to[1] });
}

describe('холст редактора', () => {
  it('стрелки двигают выбранный сектор, Shift со стрелками меняет размер', async () => {
    const user = userEvent.setup();
    renderEditor('Клубная');
    screen.getByRole('application').focus();
    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(screen.getByText('Танцпол: x 210, y 130, 440 × 260')).toBeInTheDocument();
    await user.keyboard('{Shift>}{ArrowLeft}{ArrowUp}{/Shift}');
    expect(screen.getByText('Танцпол: x 210, y 130, 430 × 250')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeEnabled();
  });

  it('сектор перетаскивается мышью с привязкой к сетке', async () => {
    renderEditor('Танцпол + трибуны');
    const svg = canvasSvg();
    const label = within(svg).getByText('Сектор B');
    drag(label, svg, [400, 450], [323, 404]);
    expect(sectorButton('Сектор B')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    const b = getLayout(layoutId('Танцпол + трибуны')).data.sections.find(
      (s) => s.name === 'Сектор B'
    );
    expect(shapeRect(b.shape)).toMatchObject({ x: 120, y: 330 });
  });

  it('угловая ручка меняет размер, места перестраиваются', () => {
    renderEditor('Танцпол + трибуны');
    fireEvent.click(sectorButton('Сектор B'));
    const svg = canvasSvg();
    const seats = () => [...svg.querySelectorAll('[data-section] rect')];
    const before = seats().map((r) => r.getAttribute('x'));
    const handle = svg.querySelector('[data-corner="se"] rect');
    drag(handle, svg, [640, 560], [500, 620]);
    const after = seats().map((r) => r.getAttribute('x'));
    expect(after).toHaveLength(before.length);
    expect(after).not.toEqual(before);
    expect(sectorButton('Сектор B')).toHaveTextContent('12 рядов · 360 мест');
    expect(screen.getByText(/· черновик/)).toBeInTheDocument();
  });

  it('инструмент «Стоячая зона» рисует новую зону и возвращает «Выбор»', async () => {
    const user = userEvent.setup();
    renderEditor('Клубная');
    await user.click(screen.getByRole('button', { name: 'Стоячая зона' }));
    expect(screen.getByRole('button', { name: 'Стоячая зона' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const svg = canvasSvg();
    drag(svg, svg, [20, 600], [200, 630]);
    expect(sectorButton('Стоячая зона 2')).toHaveAttribute('aria-pressed', 'true');
    expect(sectorButton('Стоячая зона 2')).toHaveTextContent('стоячая · 300');
    expect(screen.getByRole('button', { name: 'Выбор' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
