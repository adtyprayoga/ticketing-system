import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createDb } from '../src/db/client.ts';
import type { ControllableClock } from '../src/deps.ts';
import { appClock } from '../src/payments/simulator.ts';
import { buildTestApp, testConfig, type TestApp } from './support/app.ts';
import { resetDatabase } from './support/db.ts';
import { onSale, pendingOrder } from './support/sale.ts';

// The app runs on the same clock as `npm run dev` here, not the fixed test clock: this file
// checks that a separate `npm run reconcile` process sees where the simulator moved it.
let t: TestApp;
let pool: { end(): Promise<void> };
beforeAll(async () => {
  const config = testConfig();
  const own = createDb(config.databaseUrl);
  pool = own.pool;
  await resetDatabase(own.db);
  t = await buildTestApp({ clock: (await appClock(own.db, config)) as ControllableClock });
});
afterAll(async () => {
  await t.close();
  await pool.end();
});

const runReconcile = () =>
  promisify(execFile)(
    process.execPath,
    [fileURLToPath(new URL('../src/reconciliation/cli.ts', import.meta.url))],
    {
      env: {
        ...process.env,
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        REDIS_URL: process.env.TEST_REDIS_URL,
        PAYMENT_PROVIDER: 'simulator',
      },
    },
  );

test('npm run reconcile expires an order the simulator clock moved past its deadline', async () => {
  const { buyer, category, event } = await onSale(t, 1);
  const order = await pendingOrder(buyer, category.id);

  await runReconcile();
  expect((await buyer.get(`/api/orders/${order.id}`)).body.status).toBe('pending');

  const advanced = await request(t.app).post('/api/simulator/clock/advance').send({ minutes: 11 });
  expect(advanced.status).toBe(200);
  await runReconcile();

  expect((await buyer.get(`/api/orders/${order.id}`)).body.status).toBe('expired');
  expect((await request(t.app).get(`/api/events/${event.slug}`)).body.categories[0].available).toBe(
    1,
  );
});
