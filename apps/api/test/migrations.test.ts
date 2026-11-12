import { afterAll, expect, test } from 'vitest';
import { createDb } from '../src/db/client.ts';
import { runMigrations } from '../src/db/migrate.ts';

const { db, pool } = createDb(process.env.TEST_DATABASE_URL!);
afterAll(() => pool.end());

test('running migrations twice is a no-op the second time', async () => {
  const count = async () =>
    (await pool.query('select count(*)::int as n from drizzle.__drizzle_migrations')).rows[0].n;
  await runMigrations(db);
  const first = await count();
  await runMigrations(db);
  expect(first).toBeGreaterThan(0);
  expect(await count()).toBe(first);
});
