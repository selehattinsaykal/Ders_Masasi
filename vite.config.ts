import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Göreli taban: GitHub Pages'te depo adı ne olursa olsun çalışır.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0') },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'py-worker.js'],
      manifest: {
        name: 'Ders Masası',
        short_name: 'Ders Masası',
        description: 'Vize ve finallere çalışma: çıkmış sorular, testler, kartlar, PDF ve Python.',
        lang: 'tr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#2747d4',
        background_color: '#f6f7fb',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // pdf.js yardımcı dosyaları da önbelleğe alınır: PDF'ler ilk günden çevrimdışı açılır.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}', 'pdfjs/**/*'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            // Python sürümleri: ilk kullanımda iner, sonra çevrimdışı çalışır.
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/pyodide\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pyodide',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 400 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
})
