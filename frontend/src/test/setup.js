import '@testing-library/jest-dom';

// jsdom не реализует прокрутку: без заглушки падает любой переход к якорю.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
