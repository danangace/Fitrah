import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Browser UI build (V1). Mirrors Orca's vite.web.config.ts: the renderer is a plain web app
// that talks to the local runtime; an Electron shell can wrap the same renderer later.
export default defineConfig({
  root: resolve(import.meta.dirname, 'src/renderer'),
  plugins: [react(), tailwindcss()],
  server: {
    // Dev: the UI runs on Vite (5173) and proxies the runtime (start it with FITRAH_DEV=1).
    proxy: {
      '/api': 'http://127.0.0.1:4317',
      '/ws': { target: 'ws://127.0.0.1:4317', ws: true },
    },
  },
  build: {
    outDir: resolve(import.meta.dirname, 'out/web'),
    emptyOutDir: true,
  },
})
