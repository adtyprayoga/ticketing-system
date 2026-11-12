import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createDb } from '../src/db/client.ts';
import { createRedis } from '../src/redis.ts';
import { buildTestApp, type TestApp } from './support/app.ts';

let t: TestApp;
beforeAll(async () => {
  t = await buildTestApp();
});
afterAll(() => t.close());

test('reports ok when database and redis are up', async () => {
  const res = await request(t.app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok', db: 'up', redis: 'up' });
});

test('reports degraded but keeps serving when redis is down', async () => {
  const redis = createRedis('redis://127.0.0.1:1');
  const down = await buildTestApp({ redis });
  try {
    const res = await request(down.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'degraded', db: 'up', redis: 'down' });
  } finally {
    await down.close();
  }
});

test('answers 503 quickly when the database is down', async () => {
  const { db, pool } = createDb('postgres://ticketing:ticketing@127.0.0.1:1/x');
  const down = await buildTestApp({ db });
  try {
    const started = Date.now();
    const res = await request(down.app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'down', db: 'down' });
    expect(Date.now() - started).toBeLessThan(3000);
  } finally {
    await down.close();
    await pool.end();
  }
});
