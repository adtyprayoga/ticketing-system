import { execSync } from 'node:child_process';
import { e2eEnv } from '../playwright.config.ts';

// A clean, migrated and seeded test database for every e2e run.
export default function globalSetup() {
  const env = { ...process.env, ...e2eEnv };
  for (const script of ['db:migrate', 'db:reset', 'db:seed']) {
    execSync(`npm run ${script} -w apps/api`, { env, stdio: 'inherit' });
  }
}
