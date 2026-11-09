import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  projects: [
    {
      name: "unit",
      testMatch:
        /(?:contracts|api-foundation|auth-cart-unit|checkout-unit)\.spec\.ts/,
    },
    {
      name: "e2e",
      testMatch: /(?:storefront|auth-cart|checkout-orders)\.spec\.ts/,
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "msedge",
    trace: "retain-on-failure",
  },
});
