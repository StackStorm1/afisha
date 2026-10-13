import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Порт фронта из требований (.env.example FRONTEND_PORT=5173)
export default defineConfig({
  plugins: [react()],
  // .env — общий для бэка и фронта, в корне репозитория (.env.example).
  envDir: '..',
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    // Тесты страниц рендерят всё приложение, у схемы зала — сотни мест:
    // под нагрузкой параллельного прогона 5 секунд по умолчанию не хватает.
    testTimeout: 15000,
  },
});
