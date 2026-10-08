import { Navigate, Routes, Route, useParams } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop.jsx';
import HomePage from './pages/HomePage.jsx';
import EventPage from './pages/EventPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import FavoritesPage from './pages/FavoritesPage.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminEventsPage from './pages/admin/AdminEventsPage.jsx';
import AdminVenuesPage from './pages/admin/AdminVenuesPage.jsx';
import LayoutEditorPage from './pages/admin/LayoutEditorPage.jsx';
import SessionHallPage from './pages/admin/SessionHallPage.jsx';

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
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" />} />
        <Route
          path="/favorites"
          element={
            <RequireAuth reason="favorites">
              <FavoritesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/account/orders"
          element={
            <RequireAuth reason="orders">
              <OrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="events" replace />} />
          <Route path="events" element={<AdminEventsPage />} />
          <Route path="events/sessions/:sessionId/hall" element={<SessionHallPage />} />
          <Route path="venues" element={<AdminVenuesPage />} />
        </Route>
        <Route
          path="/admin/layouts/:layoutId"
          element={
            <RequireAdmin>
              <LayoutEditorPage />
            </RequireAdmin>
          }
        />
      </Routes>
    </>
  );
}
