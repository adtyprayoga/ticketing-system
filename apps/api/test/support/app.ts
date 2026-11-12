import type express from 'express';
import { createApp } from '../../src/app.ts';
import { parseConfig } from '../../src/config.ts';
import { createDb } from '../../src/db/client.ts';
import type { AppDeps, ControllableClock } from '../../src/deps.ts';
import { createSimulatorProvider } from '../../src/payments/simulator.ts';
import { createRedis, waitForRedis } from '../../src/redis.ts';
import { resetDatabase } from './db.ts';

export type TestApp = {
  app: express.Express;
  deps: AppDeps;
  clock: ControllableClock;
  close(): Promise<void>;
};

export function testClock(start = new Date('2026-11-15T00:00:00Z')): ControllableClock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance: (ms) => {
      current += ms;
    },
  };
}

export function testConfig() {
  return parseConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    REDIS_URL: process.env.TEST_REDIS_URL,
    PAYMENT_PROVIDER: 'simulator',
  });
}

/** Builds the real app against the test database and Redis; any dependency can be swapped. */
export async function buildTestApp(overrides: Partial<AppDeps> = {}): Promise<TestApp> {
  const config = overrides.config ?? testConfig();
  const own = createDb(config.databaseUrl);
  const ownRedis = createRedis(config.redisUrl);
  const clock = (overrides.clock as ControllableClock | undefined) ?? testClock();
  const deps: AppDeps = {
    db: own.db,
    redis: ownRedis,
    clock,
    payments: createSimulatorProvider({ db: overrides.db ?? own.db, clock }),
    config,
    ...overrides,
  };
  await waitForRedis(deps.redis);
  return {
    app: createApp(deps),
    deps,
    clock,
    close: async () => {
      await own.pool.end();
      ownRedis.disconnect();
      if (overrides.redis && overrides.redis !== ownRedis) overrides.redis.disconnect();
    },
  };
}

/** Fresh database and Redis for a test file. */
export async function freshTestApp(overrides: Partial<AppDeps> = {}): Promise<TestApp> {
  const t = await buildTestApp(overrides);
  await resetDatabase(t.deps.db);
  await t.deps.redis.flushdb().catch(() => {});
  return t;
}
