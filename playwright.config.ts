import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:1422",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun run dev --host 127.0.0.1 --port 1422",
    env: { SORREL_E2E: "1" },
    url: "http://127.0.0.1:1422",
    reuseExistingServer: false,
  },
});
