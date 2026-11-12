import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

if (existsSync('.env')) process.loadEnvFile('.env');

// e2e runs its own API and web servers on the test database, one port above the dev ones.
const apiPort = Number(process.env.E2E_API_PORT ?? Number(process.env.API_PORT ?? 4000) + 1);
const webPort = Number(process.env.E2E_WEB_PORT ?? Number(process.env.WEB_PORT ?? 3000) + 1);
const webOrigin = `http://localhost:${webPort}`;

export const e2eEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
  REDIS_URL: process.env.TEST_REDIS_URL ?? '',
  API_PORT: String(apiPort),
  WEB_PORT: String(webPort),
  API_ORIGIN: `http://localhost:${apiPort}`,
  WEB_ORIGIN: webOrigin,
  PAYMENT_PROVIDER: 'simulator',
  NEXT_DIST_DIR: '.next-e2e',
};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: webOrigin, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w apps/api',
      url: `http://localhost:${apiPort}/api/health`,
      env: e2eEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -w apps/web',
      url: webOrigin,
      env: e2eEnv,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
