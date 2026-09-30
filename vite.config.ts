import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// The version shown to players is major.minor from package.json plus a build
// number that only grows: the git commit count (the deploy script passes it as
// TC_BUILD because its snapshot has no .git). Never a date.
function git(args: string): string {
  try { return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' }
}
const [major, minor] = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string).split('.')
const build = process.env.TC_BUILD || git('rev-list --count HEAD') || '0'
const commit = process.env.TC_COMMIT || git('rev-parse --short HEAD') || 'dev'

// The app is served at https://webomm.ir404.site/v2/
export default defineConfig({
  base: process.env.E2E_API ? '/' : '/v2/',
  plugins: [react()],
  // version number (settings, boot log) and the commit for the debug detail
  define: { __APP_VERSION__: JSON.stringify(`${major}.${minor}.${build}`), __BUILD_ID__: JSON.stringify(commit) },
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
    // a dev build against a local stack (VITE_API_BASE= VITE_WS_BASE=ws://<this host>, base /): same-origin proxies
    // stand in for the reverse proxy that answers CORS in production
    proxy: process.env.E2E_API ? {
      '/api': process.env.E2E_API,
      '/connection': { target: process.env.E2E_WS ?? '', ws: true },
    } : undefined,
  },
})
