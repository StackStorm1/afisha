import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import EventPage from './pages/EventPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/events/:eventId" element={<EventPage />} />
    </Routes>
  );
}
