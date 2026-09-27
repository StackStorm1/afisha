import Header from './Header.jsx';
import Footer from './Footer.jsx';
import styles from './AccountLayout.module.css';

// Общая оболочка страниц кабинета: шапка, центрированная колонка, подвал.
// Переключателя разделов больше нет — «Профиль» и «Мои заказы» это отдельные
// страницы со своими адресами.
export default function AccountLayout({ children }) {
  return (
    <>
      <Header />
      <main className={styles.main}>{children}</main>
      <Footer />
    </>
  );
}
