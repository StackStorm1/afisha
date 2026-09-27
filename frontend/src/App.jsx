import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import HomePage from './pages/HomePage.jsx';
import EventPage from './pages/EventPage.jsx';
import AccountOrdersPage from './pages/AccountOrdersPage.jsx';
import AccountProfilePage from './pages/AccountProfilePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import FavoritesPage from './pages/FavoritesPage.jsx';
import SeatsPage from './pages/SeatsPage.jsx';
import OrganizersPage from './pages/OrganizersPage.jsx';
import RefundsPage from './pages/RefundsPage.jsx';
import SupportPage from './pages/SupportPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

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
        <Route
          path="/events/:eventId/sessions/:sessionId/seats"
          element={
            <RequireAuth>
              <SeatsPage />
            </RequireAuth>
          }
        />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route
          path="/account"
          element={
            <RequireAuth>
              <AccountProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/account/orders"
          element={
            <RequireAuth>
              <AccountOrdersPage />
            </RequireAuth>
          }
        />
        <Route path="/account/profile" element={<Navigate to="/account" replace />} />
        <Route path="/organizers" element={<OrganizersPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
