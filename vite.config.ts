import { fileURLToPath, URL } from 'node:url'
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
      // Two independent pages share this one Vite config: the game's own
      // React app (index.html) and the standalone world-city demo
      // (world-city.html, src/demo/worldCity.ts) — plain three.js, no
      // React, its own entry so it never pulls the game's screens or api
      // client into its bundle. Declaring both here is what makes `vite
      // build` emit world-city.html at all; left implicit, Vite only ever
      // builds the root index.html.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        worldCity: fileURLToPath(new URL('./world-city.html', import.meta.url)),
      },
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
