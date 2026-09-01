import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 20_000,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node scripts/serve-dist.mjs', url: 'http://127.0.0.1:4175', reuseExistingServer: true, timeout: 15_000 },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1280, height: 900 },
      },
    },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
})
