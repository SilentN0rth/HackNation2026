import { defineConfig, devices } from "@playwright/test";

/**
 * E2E na działającym serwerze dev (domyślnie http://localhost:3000, tryb mocków).
 * Uruchom: `npm run dev` w osobnym terminalu, potem `npm run e2e`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
