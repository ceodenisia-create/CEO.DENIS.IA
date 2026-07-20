import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  // Rutas relativas: necesario para que la app de escritorio (Electron)
  // cargue los assets desde file://. No afecta al deploy web.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'CEO DENIS — Centro de Operaciones Denis',
        short_name: 'CEO DENIS',
        description: 'Centro de operaciones personal: agenda, proyectos, hábitos, radar de vida, brújula y más.',
        // Absolutos a propósito: aunque el build web usa base: './' (por
        // Electron), el manifest necesita start_url/scope absolutos — con
        // rutas relativas Chrome en Android no ofrece "Instalar app".
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1c1917',
        theme_color: '#6B1E2E',
        lang: 'es',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // No cachear llamadas a Supabase/API: siempre deben ir a la red.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
