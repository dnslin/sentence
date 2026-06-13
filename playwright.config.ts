import { defineConfig, devices } from "@playwright/test"

const testDatabasePath = "test-data/e2e/juhua.sqlite"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "pnpm run test:e2e:reset-db && pnpm run db:setup && pnpm run build && next start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: {
      JUHUA_DATABASE_PATH: testDatabasePath,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
