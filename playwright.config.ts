import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  // One worker, since the specs share a database and mutate company-wide auth policy.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
