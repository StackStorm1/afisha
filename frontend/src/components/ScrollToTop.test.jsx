import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ScrollToTop from './ScrollToTop.jsx';

function renderRoutes() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Link to="/events/e1">К событию</Link>} />
        <Route path="/events/:eventId" element={<BackLink />} />
      </Routes>
    </MemoryRouter>
  );
}

function BackLink() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Назад
    </button>
  );
}

beforeEach(() => {
  vi.mocked(window.scrollTo).mockClear();
});

describe('ScrollToTop', () => {
  it('первая отрисовка страницу не перематывает', () => {
    renderRoutes();

    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('переход на другую страницу поднимает к началу', async () => {
    const user = userEvent.setup();
    renderRoutes();

    await user.click(screen.getByRole('link', { name: 'К событию' }));

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'instant',
    });
  });

  it('возврат по «назад» позицию не сбрасывает', async () => {
    const user = userEvent.setup();
    renderRoutes();

    await user.click(screen.getByRole('link', { name: 'К событию' }));
    vi.mocked(window.scrollTo).mockClear();
    await user.click(screen.getByRole('button', { name: 'Назад' }));

    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
