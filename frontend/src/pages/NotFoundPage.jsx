import InfoScreen from '../components/InfoScreen.jsx';

export default function NotFoundPage() {
  return (
    <InfoScreen
      code="404"
      title="Страница не найдена"
      text="Возможно, ссылка устарела или раздел ещё не готов."
      ctaTo="/"
      ctaLabel="На главную"
    />
  );
}
