import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom не реализует прокрутку. Без заглушек ScrollToTop валит в вывод тестов
// «Not implemented» на каждом переходе, а переход к якорю падает.
window.scrollTo = vi.fn();
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom не реализует модальный <dialog>: открытие и закрытие сводим к
// атрибуту open и событию close, как в браузере.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
