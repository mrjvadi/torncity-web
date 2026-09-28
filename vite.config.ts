import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app is served at https://webomm.ir404.site/v2/
export default defineConfig({
  base: '/v2/',
  plugins: [react()],
  // The build's own stamp (UTC), shown in the menu so a player can say which
  // version they are looking at.
  define: { __BUILD_ID__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          // React itself barely ever changes between deploys; keeping it out
          // of the app chunk means a normal deploy does not invalidate the
          // one dependency most worth caching long-term.
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    host: true,
  },
})
