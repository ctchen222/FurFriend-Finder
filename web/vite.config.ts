import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, strictPort: true,
    proxy: {
      // Preserve the browser Host so the backend origin check remains meaningful.
      '/api': { target: 'http://127.0.0.1:2486', changeOrigin: false },
      '/health': { target: 'http://127.0.0.1:2486', changeOrigin: false },
      '/images': { target: 'http://127.0.0.1:2486', changeOrigin: false },
    },
  },
  build: { manifest: true },
});
