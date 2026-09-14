import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'https://restourant-eoj3.onrender.com',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'https://restourant-eoj3.onrender.com',
        ws: true,
        changeOrigin: true,
      },
      '/uploads': {
        target: 'https://restourant-eoj3.onrender.com',
        changeOrigin: true,
      }
    }
  }
});

