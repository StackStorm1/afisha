import { useCallback, useRef, useState } from 'react';
import styles from './SchemeTip.module.css';

const WIDTH = 240;
const EDGE = 4;
// Примерная высота подсказки: если до верха окна меньше — она под точкой.
const FLIP_HEIGHT = 130;

// Подсказка при наведении мышью на место или сектор схемы: что это, цена,
// остаток и что будет по клику. Только для мыши: на касании наведения нет,
// а для скринридера всё это уже в подписи элемента или в «Выборе без схемы».
// resolve(target) по элементу под курсором возвращает
// { key, el, anchor: 'top' | 'center', name, price, sub, hint } или null.
// Текст считается при каждой отрисовке, а не запоминается: после клика по
// месту подсказка сразу говорит «убрать» вместо «выбрать».
export function useSchemeTip(resolve) {
  const wrapRef = useRef(null);
  const [target, setTarget] = useState(null);

  const hide = useCallback(() => setTarget(null), []);

  const onPointerMove = useCallback(
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const found = resolve(e.target);
      // Курсор внутри того же элемента — состояние не трогаем.
      setTarget((prev) => {
        if (!found) return null;
        return prev && resolve(prev)?.key === found.key ? prev : e.target;
      });
    },
    [resolve]
  );

  const found = target && wrapRef.current ? resolve(target) : null;
  let tip = null;
  if (found && found.el.isConnected) {
    const wrap = wrapRef.current.getBoundingClientRect();
    const rect = found.el.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - wrap.left;
    const center = found.anchor === 'center';
    const below = (center ? rect.top + rect.height / 2 : rect.top) - FLIP_HEIGHT < 0;
    let y = center ? rect.top + rect.height / 2 : below ? rect.bottom : rect.top;
    y -= wrap.top;
    const left = Math.min(
      Math.max(x, WIDTH / 2 + EDGE),
      Math.max(wrap.width - WIDTH / 2 - EDGE, WIDTH / 2 + EDGE)
    );
    tip = { ...found, x: left, y, below, arrow: x - left };
  }

  return {
    tip,
    wrapProps: {
      ref: wrapRef,
      onPointerMove,
      onPointerLeave: hide,
      // Прокрутка уводит элемент из-под подсказки.
      onScrollCapture: hide,
    },
  };
}

export default function SchemeTip({ tip }) {
  if (!tip) return null;
  return (
    <div
      className={styles.tip}
      role="tooltip"
      data-below={tip.below}
      style={{ left: tip.x, top: tip.y, '--arrow': `${tip.arrow}px` }}
    >
      <div className={styles.body}>
        <span className={styles.name}>{tip.name}</span>
        <span className={styles.price}>{tip.price}</span>
        {tip.sub && <span className={styles.sub}>{tip.sub}</span>}
        {tip.hint && <span className={styles.hint}>{tip.hint}</span>}
      </div>
    </div>
  );
}
