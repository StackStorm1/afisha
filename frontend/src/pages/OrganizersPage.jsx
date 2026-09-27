import InfoPage from '../components/InfoPage.jsx';

export default function OrganizersPage() {
  return (
    <InfoPage
      eyebrow="Для организаторов"
      title="Организаторам"
      lead="Разместите событие на Stack Afisha и продавайте билеты напрямую — без комиссии за первый месяц."
    >
      <section>
        <h2>Как разместить событие</h2>
        <p>
          Пришлите название, даты сеансов, площадку и схему зала — мы подключим продажу
          билетов и выделенную страницу события в каталоге за один рабочий день.
        </p>
      </section>
      <section>
        <h2>Что вы получаете</h2>
        <p>
          Онлайн-продажу с бронированием мест, статистику по сеансам и выплаты на
          расчётный счёт. Возвраты и поддержку зрителей мы берём на себя.
        </p>
      </section>
      <section>
        <h2>Связаться</h2>
        <p>
          Напишите на <a href="mailto:partners@stackafisha.ru">partners@stackafisha.ru</a>{' '}
          — ответим в течение дня.
        </p>
      </section>
    </InfoPage>
  );
}
