import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app is served at https://webomm.ir404.site/v2/
export default defineConfig({
  base: '/v2/',
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
  server: {
    host: true,
  },
})
