import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Rutas relativas: necesario para que la app de escritorio (Electron)
  // cargue los assets desde file://. No afecta al deploy web.
  base: './',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
