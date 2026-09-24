import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: when you deploy a new build, installed apps pick it up on the
      // next launch/refresh — no one gets stuck on a stale version.
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon-64.png'],
      manifest: {
        name: 'Nexusora Books',
        short_name: 'Nexusora Books',
        description: 'Smart, multi-tenant accounting — invoicing, payroll, PAYE, SSNIT and AI-powered insights.',
        theme_color: '#012158',
        background_color: '#012158',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell (HTML/JS/CSS) so it opens instantly and
        // works offline for navigation.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // The app bundle is ~2.3MB (single chunk); raise the precache ceiling
        // above 2MB default so it gets cached for offline/instant launch.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,  // 4 MiB
        // CRITICAL for an accounting app: never serve cached API data. Every
        // /api call goes to the network so balances, invoices and payments are
        // always live. If the network is down the request simply fails (as it
        // would in the browser) rather than showing stale financials.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
        ],
      },
      // Don't take over the page in dev; only active in the production build.
      devOptions: { enabled: false },
    }),
  ],
  build: {
    // Code-splitting: break the big vendor libraries into their own chunks so the
    // browser loads them in parallel and caches them across deploys (they change
    // far less often than app code). This shrinks the main bundle and speeds up
    // first load — especially on slower mobile connections.
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — rarely changes, cached long-term.
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Animation library — sizeable, used widely but changes rarely.
          'motion-vendor': ['framer-motion'],
          // Icons — large set, pulled in across many pages.
          'icons-vendor': ['react-icons'],
        },
      },
    },
    // The largest chunk (a vendor bundle) is legitimately over 500 kB; lift the
    // warning ceiling so a green build isn't cluttered by an expected notice.
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
          });
        },
      },
    },
  },
});