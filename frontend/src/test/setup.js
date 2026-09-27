import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom не реализует window.scrollTo: без заглушки ScrollToTop валит в вывод
// тестов «Not implemented» на каждом переходе.
window.scrollTo = vi.fn();
