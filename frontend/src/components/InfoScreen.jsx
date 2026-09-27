import { Link } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import styles from './InfoScreen.module.css';

// Единый экран-заглушка для страниц без контента (404, «в разработке»):
// заголовок, пояснение и CTA — вместо пустой страницы.
export default function InfoScreen({ code, title, text, ctaTo, ctaLabel }) {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.box}>
          {code && <span className={styles.code}>{code}</span>}
          <h1 className={styles.title}>{title}</h1>
          {text && <p className={styles.text}>{text}</p>}
          {ctaTo && (
            <Link to={ctaTo} className={styles.cta}>
              {ctaLabel}
            </Link>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
