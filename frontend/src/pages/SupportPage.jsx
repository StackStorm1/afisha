import InfoPage from '../components/InfoPage.jsx';

export default function SupportPage() {
  return (
    <InfoPage
      eyebrow="Помощь"
      title="Поддержка"
      lead="Мы на связи каждый день с 9:00 до 21:00 по московскому времени."
    >
      <section>
        <h2>Как связаться</h2>
        <p>
          Почта <a href="mailto:support@stackafisha.ru">support@stackafisha.ru</a> и
          телефон <a href="tel:+78001234567">8 800 123-45-67</a> (звонок по России
          бесплатный).
        </p>
      </section>
      <section>
        <h2>Что мы решаем</h2>
        <p>
          Помогаем с оплатой и возвратом билетов, восстанавливаем доступ к заказам и
          разбираемся, если место или сеанс отображаются неверно.
        </p>
      </section>
      <section>
        <h2>Перед обращением</h2>
        <p>
          Проверьте «Мои заказы» — статус оплаты, места и сеанс видны там. Если заказа нет
          в списке, напишите нам почту, с которой оформляли покупку.
        </p>
      </section>
    </InfoPage>
  );
}
