import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { freshTestApp, type TestApp } from './support/app.ts';
import { agentWithRole } from './support/auth.ts';

let t: TestApp;
beforeAll(async () => {
  t = await freshTestApp();
});
afterAll(() => t.close());

test('unauthenticated requests get 401 on staff and admin routes', async () => {
  for (const path of ['/api/staff/ping', '/api/admin/ping']) {
    const res = await request(t.app).get(path);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthenticated' });
  }
});

test('buyers get 403 on staff and admin routes', async () => {
  const buyer = await agentWithRole(t, 'buyer');
  for (const path of ['/api/staff/ping', '/api/admin/ping']) {
    const res = await buyer.get(path);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  }
});

test('staff reach staff routes but not admin routes', async () => {
  const staff = await agentWithRole(t, 'staff');
  expect((await staff.get('/api/staff/ping')).status).toBe(200);
  expect((await staff.get('/api/admin/ping')).status).toBe(403);
});

test('admins reach admin routes', async () => {
  const admin = await agentWithRole(t, 'admin');
  expect((await admin.get('/api/admin/ping')).status).toBe(200);
});
