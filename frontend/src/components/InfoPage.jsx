import Header from './Header.jsx';
import Footer from './Footer.jsx';
import styles from './InfoPage.module.css';

// Каркас информационной страницы (ссылки из подвала): шапка, заголовок с
// лидом и колонка контента. Разделы страница передаёт через children.
export default function InfoPage({ eyebrow, title, lead, children }) {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <header className={styles.head}>
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
          <h1 className={styles.title}>{title}</h1>
          {lead && <p className={styles.lead}>{lead}</p>}
        </header>
        <div className={styles.body}>{children}</div>
      </main>
      <Footer />
    </>
  );
}
