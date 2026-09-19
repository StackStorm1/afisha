import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Порт фронта из требований (.env.example FRONTEND_PORT=5173)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
