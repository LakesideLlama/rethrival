import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/rethrival/',
  build: {
    outDir: 'dist',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: null,
      },
      manifest: {
        name: 'ReThrival',
        short_name: 'ReThrival',
        description: 'A top-down survival crafting game',
        theme_color: '#0a1628',
        background_color: '#0a1628',
        display: 'standalone',
        icons: [],
      },
    }),
  ],
});
