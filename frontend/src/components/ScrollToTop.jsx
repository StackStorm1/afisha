import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// SPA не перематывает страницу сама: открыв событие из середины ленты, посетитель
// оказывался сразу в подвале карточки. Возврат по «назад» (POP) не трогаем —
// там ожидаемо остаться на том же месте, откуда ушёл.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, navigationType]);

  return null;
}
