import { defineConfig, devices } from "@playwright/test";
// Commerce end-to-end tests; run through `npm run test:commerce`, which starts
// the store's server build and the provider stand-ins first.
export default defineConfig({
  testDir: "./tests/commerce",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: `${process.env.COMMERCE_STORE_URL ?? "http://127.0.0.1:4310"}/`,
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
