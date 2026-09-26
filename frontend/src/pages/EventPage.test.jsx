import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import EventPage from './EventPage.jsx';
import { listEvents, listEventSessions } from '../data/events.js';
import { formatMonthShort, formatTime } from '../lib/format.js';
import { addDaysIso, todayIso } from '../lib/dateStrip.js';

const catalog = listEvents({ per_page: 500 }).data;

function activeSessions(eventId) {
  return listEventSessions(eventId).filter((s) => s.status === 'active');
}

function eventWithFarSession() {
  const horizon = addDaysIso(todayIso(), 14);
  return catalog.find((event) =>
    activeSessions(event.id).some((s) => s.starts_at.slice(0, 10) > horizon)
  );
}

function renderEvent(eventId) {
  return render(
    <MemoryRouter initialEntries={[`/events/${eventId}`]}>
      <Routes>
        <Route path="/events/:eventId" element={<EventPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EventPage — лента дат достаёт до дальних сеансов', () => {
  it('день сеанса через месяц есть в ленте, и по клику показываются его сеансы', async () => {
    const user = userEvent.setup();
    const event = eventWithFarSession();
    expect(event).toBeDefined();

    const horizon = addDaysIso(todayIso(), 14);
    const farSession = activeSessions(event.id)
      .filter((s) => s.starts_at.slice(0, 10) > horizon)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    const farDate = farSession.starts_at.slice(0, 10);

    renderEvent(event.id);

    const strip = screen.getByRole('button', {
      name: new RegExp(`${Number(farDate.slice(8, 10))}\\s*${formatMonthShort(farDate)}`),
    });
    await user.click(strip);

    // Время дальнего сеанса в списке — значит день реально выбран.
    expect(screen.getByText(formatTime(farSession.starts_at))).toBeInTheDocument();
  });

  it('в ленте нет дней без сеансов', () => {
    const event = eventWithFarSession();
    const { container } = renderEvent(event.id);

    const chips = container.querySelectorAll('[class*="dateChip"]');
    const expectedDays = new Set(
      listEventSessions(event.id)
        .map((s) => s.starts_at.slice(0, 10))
        .filter((date) => date >= todayIso())
    );

    expect(chips.length).toBe(expectedDays.size);
    for (const chip of chips) {
      expect(within(chip).queryByText('—')).toBeNull();
    }
  });
});

describe('EventPage — панели фильтров каталога нет', () => {
  it('в хедере нет чипов дат, цены, категорий и площадки', () => {
    renderEvent(catalog[0].id);

    for (const name of [
      /^Цена/,
      /^Площадка/,
      /^Ещё фильтры/,
      'Выходные',
      'Выбрать даты',
      'Концерты',
    ]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('поиск и избранное в хедере остаются', () => {
    renderEvent(catalog[0].id);

    expect(
      screen.getByPlaceholderText('Поиск по названию или площадке')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Избранное/ })).toBeInTheDocument();
  });
});

describe('EventPage — числительные согласованы с существительными', () => {
  it('«Свободно N мест» склоняется по правилам русского языка', () => {
    let checked = 0;
    for (const event of catalog.slice(0, 12)) {
      const { container, unmount } = renderEvent(event.id);
      const labels = within(container).queryAllByText(/^Свободно /);
      for (const node of labels) {
        expect(node.textContent).toMatch(
          /^Свободно \d+ (место|места|мест)( — почти разобрали)?$/
        );
      }
      checked += labels.length;
      unmount();
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('состав зала подписан склонёнными рядами и местами', () => {
    renderEvent(catalog[0].id);

    expect(screen.getByText(/^Зал: /).textContent).toMatch(
      /^Зал: \d+ (ряд|ряда|рядов) по \d+ (место|места|мест)\./
    );
  });
});
