import { describe, it, expect } from 'vitest';
import { listEvents, getEvent, listEventSessions, getSession } from './events.js';
import {
  expectEventSummary,
  expectSession,
  expectPagination,
} from './schemaAssertions.js';

describe('events mock — форма ответа EventListResponse', () => {
  it('data и pagination соответствуют required-полям контракта', () => {
    const { data, pagination } = listEvents();
    expect(data.length).toBeGreaterThan(0);
    for (const event of data) expectEventSummary(event);
    expectPagination(pagination);
  });

  it('пагинация режет выдачу по per_page', () => {
    const { data, pagination } = listEvents({ per_page: 5, page: 1 });
    expect(data.length).toBe(5);
    expect(pagination.per_page).toBe(5);
  });

  it('фильтр по категории возвращает только её события', () => {
    const { data } = listEvents({ category: 'theatre' });
    expect(data.length).toBeGreaterThan(0);
    for (const event of data) expect(event.category.slug).toBe('theatre');
  });

  it('поиск по названию — регистронезависимый substring', () => {
    const all = listEvents({ per_page: 200 }).data;
    const sample = all[0];
    const needle = sample.title.slice(0, 3).toUpperCase();
    const { data } = listEvents({ q: needle, per_page: 200 });
    expect(data.some((event) => event.id === sample.id)).toBe(true);
  });

  it('в каталоге только события хотя бы с одним активным сеансом', () => {
    // Контракт: и каталог, и карточка отдают только события с хотя бы одним
    // активным сеансом (EventSummary description в openapi.yaml).
    const { data } = listEvents({ per_page: 500 });
    for (const event of data) expect(event.sessions_count).toBeGreaterThanOrEqual(1);
  });

  it('сортировка price_asc — по возрастанию min_price', () => {
    const { data } = listEvents({ sort: 'price_asc', per_page: 500 });
    for (let i = 1; i < data.length; i += 1) {
      expect(Number(data[i].min_price)).toBeGreaterThanOrEqual(
        Number(data[i - 1].min_price)
      );
    }
  });
});

describe('events mock — сеансы события', () => {
  it('getEvent(id) отдаёт ту же форму, что и элемент списка', () => {
    const sample = listEvents().data[0];
    const event = getEvent(sample.id);
    expectEventSummary(event);
    expect(event.id).toBe(sample.id);
  });

  it('getEvent для несуществующего id — null', () => {
    expect(getEvent('00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('listEventSessions отдаёт Session[] в форме контракта, отсортированные по дате', () => {
    const sample = listEvents().data[0];
    const sessions = listEventSessions(sample.id);
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions) expectSession(session);
    for (let i = 1; i < sessions.length; i += 1) {
      expect(sessions[i].starts_at >= sessions[i - 1].starts_at).toBe(true);
    }
  });

  it('getSession находит сеанс по id внутри любого события', () => {
    const sample = listEvents().data[0];
    const sessions = listEventSessions(sample.id);
    const found = getSession(sessions[0].id);
    expectSession(found);
    expect(found.id).toBe(sessions[0].id);
  });
});
