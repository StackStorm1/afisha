import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { startExpirySweep } from './data/orders.js';
import { useAuth } from './store/useAuth.js';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient();

// Фоновое освобождение истёкших броней раз в минуту (BR-02): без него
// бронь, брошенная без оплаты, держит места до перезагрузки вкладки.
// При истечении сбрасываем кэш, чтобы освободившиеся места отрисовались.
startExpirySweep(() => queryClient.invalidateQueries());

// US-09: сессия переживает перезагрузку — сохранённый токен проверяется
// через /auth/me до того, как защищённые страницы решат, пускать ли.
useAuth.getState().restore();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
