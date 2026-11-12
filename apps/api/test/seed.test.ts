import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { seed } from '../src/db/seed.ts';
import { freshTestApp, type TestApp } from './support/app.ts';
import { signIn } from './support/auth.ts';

let t: TestApp;
beforeAll(async () => {
  t = await freshTestApp();
});
afterAll(() => t.close());

test('seeding twice creates each account once', async () => {
  await seed(t.deps);
  await seed(t.deps);
  const { rows } = await t.deps.db.execute<{ role: string; n: number }>(
    sql`select role, count(*)::int as n from "user" group by role order by role`,
  );
  expect(rows).toEqual([
    { role: 'admin', n: 1 },
    { role: 'buyer', n: 1 },
    { role: 'staff', n: 3 },
  ]);
});

test('the seeded admin can sign in', async () => {
  const a = await signIn(t, 'admin@example.com', 'workshop-password');
  expect((await a.get('/api/me')).body.role).toBe('admin');
});

test('the seeded demo race is public with one 12K category', async () => {
  const request = (await import('supertest')).default;
  await seed(t.deps);
  const res = await request(t.app).get('/api/events/jakarta-night-run-2026');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    name: 'Jakarta Night Run 2026',
    startsAt: '2026-12-06T12:00:00.000Z',
    venue: 'Gelora Bung Karno',
    categories: [{ name: '12K', price: 150000, capacity: 3 }],
  });
});

test('staff1 and staff2 work the demo race; staff3 is unassigned', async () => {
  await seed(t.deps);
  for (const [email, count] of [
    ['staff1@example.com', 1],
    ['staff2@example.com', 1],
    ['staff3@example.com', 0],
  ] as const) {
    const staff = await signIn(t, email, 'workshop-password');
    expect((await staff.get('/api/staff/events')).body).toHaveLength(count);
  }
});
