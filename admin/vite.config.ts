import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-docs': ['jspdf', 'jspdf-autotable', 'xlsx'],
          'vendor-socket': ['socket.io-client', 'axios']
        }
      }
    }
  },
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

