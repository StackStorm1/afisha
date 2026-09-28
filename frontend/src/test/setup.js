import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom не реализует прокрутку. Без заглушек ScrollToTop валит в вывод тестов
// «Not implemented» на каждом переходе, а переход к якорю падает.
window.scrollTo = vi.fn();
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
