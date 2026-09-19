import { useState } from 'react';
import styles from './PosterImage.module.css';

// Постера может не быть в моке (poster_url: null) или картинка может не
// загрузиться — в обоих случаях штриховой плейсхолдер, а не битая иконка.
export default function PosterImage({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className={styles.placeholder} aria-hidden="true" />;
  }

  return (
    <img
      className={styles.image}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
