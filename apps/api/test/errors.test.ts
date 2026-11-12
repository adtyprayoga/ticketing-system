import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { buildTestApp, type TestApp } from './support/app.ts';

let t: TestApp;
beforeAll(async () => {
  t = await buildTestApp();
});
afterAll(() => t.close());

test('an unknown api route returns a json 404', async () => {
  const res = await request(t.app).get('/api/nope');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'not_found' });
});

test('a malformed json body returns a json 400', async () => {
  const res = await request(t.app)
    .post('/api/health')
    .set('Content-Type', 'application/json')
    .send('{bad');
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'invalid_json' });
});
