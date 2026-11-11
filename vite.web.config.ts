import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Browser UI build (V1). Mirrors Orca's vite.web.config.ts: the renderer is a plain web app
// that talks to the local runtime; an Electron shell can wrap the same renderer later.
export default defineConfig({
  root: resolve(import.meta.dirname, 'src/renderer'),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(import.meta.dirname, 'out/web'),
    emptyOutDir: true,
  },
})
