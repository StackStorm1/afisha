import { useParams } from 'react-router-dom';
import InfoScreen from '../components/InfoScreen.jsx';

// Плейсхолдер выбора мест (US-10…14). Полный флоу покупки — отдельная задача;
// маршрут закрыт RequireAuth, поэтому гость сначала попадает на логин.
export default function SeatsPage() {
  const { eventId } = useParams();
  return (
    <InfoScreen
      title="Выбор мест"
      text="Схема зала и покупка билетов появятся здесь — раздел в разработке."
      ctaTo={`/events/${eventId}`}
      ctaLabel="Назад к событию"
    />
  );
}
