import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { freshTestApp, type TestApp } from './support/app.ts';
import { agentWithRole } from './support/auth.ts';
import { createCategory, createEvent } from './support/catalog.ts';

let t: TestApp;
let admin: Agent;
let eventId: string;
beforeAll(async () => {
  t = await freshTestApp();
  admin = await agentWithRole(t, 'admin');
  eventId = (await createEvent(admin)).id;
});
afterAll(() => t.close());

test('adds a ticket category with sales open', async () => {
  const res = await admin
    .post(`/api/admin/events/${eventId}/categories`)
    .send({ name: '12K', price: 150000, capacity: 3 });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({
    eventId,
    name: '12K',
    price: 150000,
    capacity: 3,
    held: 0,
    salesOpen: true,
  });
  const list = await admin.get(`/api/admin/events/${eventId}/categories`);
  expect(list.body.map((c: { id: string }) => c.id)).toContain(res.body.id);
});

test('rejects a non-positive or fractional price and capacity per field', async () => {
  const res = await admin
    .post(`/api/admin/events/${eventId}/categories`)
    .send({ name: '', price: 0, capacity: 1.5 });
  expect(res.status).toBe(400);
  expect(Object.keys(res.body.fields).sort()).toEqual(['capacity', 'name', 'price']);
});

test('adding to an unknown event is a 404', async () => {
  const res = await admin
    .post('/api/admin/events/00000000-0000-4000-8000-000000000000/categories')
    .send({ name: '5K', price: 100000, capacity: 10 });
  expect(res.status).toBe(404);
});

test('edits name, price and capacity', async () => {
  const category = await createCategory(admin, eventId);
  const res = await admin
    .patch(`/api/admin/categories/${category.id}`)
    .send({ name: '12K Elite', price: 175000, capacity: 5 });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ name: '12K Elite', price: 175000, capacity: 5 });
});

test('closes and reopens sales', async () => {
  const category = await createCategory(admin, eventId);
  const closed = await admin
    .patch(`/api/admin/categories/${category.id}`)
    .send({ salesOpen: false });
  expect(closed.body.salesOpen).toBe(false);
  const open = await admin.patch(`/api/admin/categories/${category.id}`).send({ salesOpen: true });
  expect(open.body.salesOpen).toBe(true);
});

test('deletes a category without orders', async () => {
  const category = await createCategory(admin, eventId);
  expect((await admin.delete(`/api/admin/categories/${category.id}`)).status).toBe(204);
  const list = await admin.get(`/api/admin/events/${eventId}/categories`);
  expect(list.body.map((c: { id: string }) => c.id)).not.toContain(category.id);
});

test('deleting an event deletes its categories', async () => {
  const event = await createEvent(admin);
  const category = await createCategory(admin, event.id);
  await admin.delete(`/api/admin/events/${event.id}`);
  expect(
    (await admin.patch(`/api/admin/categories/${category.id}`).send({ name: 'x' })).status,
  ).toBe(404);
});

test('non-admins are refused every category route', async () => {
  const category = await createCategory(admin, eventId);
  const buyer = await agentWithRole(t, 'buyer');
  const calls = (a: Agent | ReturnType<typeof request>) => [
    a.get(`/api/admin/events/${eventId}/categories`),
    a.post(`/api/admin/events/${eventId}/categories`).send({ name: '5K', price: 1, capacity: 1 }),
    a.patch(`/api/admin/categories/${category.id}`).send({ name: 'x' }),
    a.delete(`/api/admin/categories/${category.id}`),
  ];
  for (const res of await Promise.all(calls(buyer))) expect(res.status).toBe(403);
  for (const res of await Promise.all(calls(request(t.app)))) expect(res.status).toBe(401);
});
