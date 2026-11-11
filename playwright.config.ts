import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4398',
    channel: 'chrome', // the installed Google Chrome; no browser download
    headless: true,
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    command: 'pnpm -s build:ui && tsx e2e/server.ts',
    url: 'http://127.0.0.1:4398/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
