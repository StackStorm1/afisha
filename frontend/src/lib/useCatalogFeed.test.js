import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCatalogFeed } from './useCatalogFeed.js';
import { useFiltersStore } from '../store/useFiltersStore.js';

// Хук размонтируется сразу после чтения: иначе setState следующего кейса
// перерисовывает хуки предыдущих.
function renderFeed(filters = {}) {
  act(() => {
    useFiltersStore.getState().resetAll();
    useFiltersStore.setState({ q: '', ...filters });
  });
  const { result, unmount } = renderHook(() => useCatalogFeed());
  const feed = result.current;
  unmount();
  return feed;
}

function renderedCards(feed) {
  return feed.rows.flatMap((row) => row.items);
}

function uniqueIds(cards) {
  return new Set(cards.map((card) => card.id));
}

beforeEach(() => {
  act(() => {
    useFiltersStore.getState().resetAll();
    useFiltersStore.setState({ q: '' });
  });
});

describe('useCatalogFeed — лента не теряет события', () => {
  it('каждая карточка попадает хотя бы в одну полку: total === число уникальных отрисованных', () => {
    const feed = renderFeed();

    expect(feed.total).toBeGreaterThan(0);
    expect(uniqueIds(renderedCards(feed)).size).toBe(feed.total);
  });

  it('то же при активных фильтрах категории и даты', () => {
    const feed = renderFeed({ category: 'theatre', time: 'week' });

    expect(uniqueIds(renderedCards(feed)).size).toBe(feed.total);
  });

  it('полки не пустые: пустая полка в ленту не попадает', () => {
    const feed = renderFeed();

    for (const row of feed.rows) expect(row.items.length).toBeGreaterThan(0);
  });
});

describe('useCatalogFeed — настраиваемый диапазон цены', () => {
  it('верхняя граница отсекает карточки дороже неё', () => {
    const prices = renderedCards(renderFeed())
      .filter((card) => !card.sold)
      .map((card) => card.minAvailable)
      .sort((a, b) => a - b);
    const bound = prices[Math.floor(prices.length / 2)];

    const feed = renderFeed({ priceMax: bound });
    const cards = renderedCards(feed);

    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.sold).toBe(false);
      expect(card.minAvailable).toBeLessThanOrEqual(bound);
    }
    expect(uniqueIds(cards).size).toBe(feed.total);
  });

  it('нижняя граница отсекает карточки дешевле неё', () => {
    const prices = renderedCards(renderFeed())
      .filter((card) => !card.sold)
      .map((card) => card.minAvailable)
      .sort((a, b) => a - b);
    const bound = prices[Math.floor(prices.length / 2)];

    const cards = renderedCards(renderFeed({ priceMin: bound }));

    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) expect(card.minAvailable).toBeGreaterThanOrEqual(bound);
  });

  it('обе границы задают вилку, а не единственный порог 1500', () => {
    const cards = renderedCards(renderFeed({ priceMin: 1000, priceMax: 1500 }));

    for (const card of cards) {
      expect(card.minAvailable).toBeGreaterThanOrEqual(1000);
      expect(card.minAvailable).toBeLessThanOrEqual(1500);
    }
  });

  it('пустая вилка (min больше любой цены) даёт пустое состояние, а не падение', () => {
    const feed = renderFeed({ priceMin: 10_000_000 });

    expect(feed.total).toBe(0);
    expect(feed.isEmpty).toBe(true);
    expect(feed.rows).toEqual([]);
  });
});

describe('useCatalogFeed — «только в продаже» и сортировка', () => {
  it('onlyAvailable убирает распроданные карточки', () => {
    const withSold = renderedCards(renderFeed());
    const withoutSold = renderedCards(renderFeed({ onlyAvailable: true }));

    expect(withSold.some((card) => card.sold)).toBe(true);
    expect(withoutSold.some((card) => card.sold)).toBe(false);
  });

  it('price_asc и price_desc дают взаимно обратный порядок событий', () => {
    const asc = renderFeed({ sort: 'price_asc' });
    const desc = renderFeed({ sort: 'price_desc' });

    const ascIds = [...uniqueIds(renderedCards(asc))];
    const descIds = [...uniqueIds(renderedCards(desc))];

    expect(asc.total).toBe(desc.total);
    expect(ascIds).not.toEqual(descIds);
    expect([...ascIds].sort()).toEqual([...descIds].sort());
  });
});
