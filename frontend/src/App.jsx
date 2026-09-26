import { Routes, Route, useParams } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop.jsx';
import HomePage from './pages/HomePage.jsx';
import EventPage from './pages/EventPage.jsx';

// key={eventId}: без него React Router переиспользует тот же экземпляр
// EventPage при переходе между двумя событиями (например, по клику на
// подсказку поиска на самой странице события) — локальное состояние вроде
// выбранного дня в ленте дат или «читать далее» тянулось бы со старого
// события на новое.
function EventPageRoute() {
  const { eventId } = useParams();
  return <EventPage key={eventId} />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events/:eventId" element={<EventPageRoute />} />
      </Routes>
    </>
  );
}
