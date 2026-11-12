import { randomUUID } from 'node:crypto';
import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { freshTestApp, type TestApp } from './support/app.ts';
import { agentWithRole } from './support/auth.ts';
import { createCategory, createEvent } from './support/catalog.ts';
import { checkout } from './support/checkout.ts';

let t: TestApp;
let admin: Agent;
let buyer: Agent;
beforeAll(async () => {
  t = await freshTestApp();
  admin = await agentWithRole(t, 'admin');
  buyer = await agentWithRole(t, 'buyer');
});
afterAll(() => t.close());

async function onSale(capacity = 3, price = 150000) {
  const event = await createEvent(admin, { name: 'Checkout Run' }, true);
  const category = await createCategory(admin, event.id, { name: '12K', price, capacity });
  return { event, category };
}

const available = async (slug: string) =>
  (await request(t.app).get(`/api/events/${slug}`)).body.categories[0].available;

test('checkout holds one place and starts a 10-minute payment window', async () => {
  const { event, category } = await onSale();
  const res = await checkout(buyer, category.id, { participantName: 'Putri Participant' });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({
    status: 'pending',
    eventName: 'Checkout Run',
    eventSlug: event.slug,
    categoryName: '12K',
    participantName: 'Putri Participant',
    amount: 150000,
    paymentDeadline: new Date(t.clock.now().getTime() + 10 * 60_000).toISOString(),
    payment: { redirectUrl: expect.stringContaining(res.body.id) },
  });
  expect(await available(event.slug)).toBe(2);
});

test('availability stays live while event details are cached', async () => {
  const { event, category } = await onSale();
  await request(t.app).get(`/api/events/${event.slug}`);
  await checkout(buyer, category.id);
  const res = await request(t.app).get(`/api/events/${event.slug}`);
  expect(res.headers['x-cache']).toBe('hit');
  expect(res.body.categories[0].available).toBe(2);
});

test('two buyers racing for the last place: exactly one gets it', async () => {
  const { event, category } = await onSale(1);
  const other = await agentWithRole(t, 'buyer');
  const results = await Promise.all([checkout(buyer, category.id), checkout(other, category.id)]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  const loser = results.find((r) => r.status === 409)!;
  expect(loser.body).toEqual({
    error: 'places_held',
    message: 'All remaining places are held. Check back in a few minutes.',
  });
  expect(await available(event.slug)).toBe(0);
});

test('a retried checkout attempt returns the same order without a second hold', async () => {
  const { event, category } = await onSale();
  const attemptKey = randomUUID();
  const first = await checkout(buyer, category.id, { attemptKey });
  const again = await checkout(buyer, category.id, { attemptKey });
  expect(again.status).toBe(200);
  expect(again.body.id).toBe(first.body.id);
  expect(again.body.payment).toEqual(first.body.payment);
  expect(await available(event.slug)).toBe(2);
});

test('a double click (same attempt, in parallel) still holds one place', async () => {
  const { event, category } = await onSale();
  const attemptKey = randomUUID();
  const [a, b] = await Promise.all([
    checkout(buyer, category.id, { attemptKey }),
    checkout(buyer, category.id, { attemptKey }),
  ]);
  expect(a.body.id).toBe(b.body.id);
  expect(await available(event.slug)).toBe(2);
});

test('a retry still returns the order when the category has since filled', async () => {
  const { category } = await onSale(1);
  const attemptKey = randomUUID();
  const first = await checkout(buyer, category.id, { attemptKey });
  const again = await checkout(buyer, category.id, { attemptKey });
  expect(again.status).toBe(200);
  expect(again.body.id).toBe(first.body.id);
});

test('a new attempt is a separate purchase with its own hold', async () => {
  const { event, category } = await onSale();
  const first = await checkout(buyer, category.id);
  const second = await checkout(buyer, category.id);
  expect(second.status).toBe(201);
  expect(second.body.id).not.toBe(first.body.id);
  expect(await available(event.slug)).toBe(1);
});

test('draft events and closed categories refuse checkout', async () => {
  const draft = await createEvent(admin);
  const draftCategory = await createCategory(admin, draft.id);
  const notPublished = await checkout(buyer, draftCategory.id);
  expect(notPublished.status).toBe(409);
  expect(notPublished.body.error).toBe('not_on_sale');

  const { category } = await onSale();
  await admin.patch(`/api/admin/categories/${category.id}`).send({ salesOpen: false });
  const closed = await checkout(buyer, category.id);
  expect(closed.status).toBe(409);
  expect(closed.body.error).toBe('not_on_sale');
});

test('checkout validates its input and needs a session', async () => {
  const bad = await buyer
    .post('/api/checkout')
    .send({ categoryId: 'x', participantName: ' ', attemptKey: 'y' });
  expect(bad.status).toBe(400);
  expect(Object.keys(bad.body.fields).sort()).toEqual([
    'attemptKey',
    'categoryId',
    'participantName',
  ]);
  const anonymous = await request(t.app)
    .post('/api/checkout')
    .send({ categoryId: randomUUID(), participantName: 'A', attemptKey: randomUUID() });
  expect(anonymous.status).toBe(401);
});

test('my orders lists only my own orders, newest first', async () => {
  const { category } = await onSale();
  const mine = await agentWithRole(t, 'buyer');
  const first = await checkout(mine, category.id);
  t.clock.advance(1000);
  const second = await checkout(mine, category.id);
  await checkout(buyer, category.id);
  const list = await mine.get('/api/orders');
  expect(list.body.map((o: { id: string }) => o.id)).toEqual([second.body.id, first.body.id]);
  expect((await buyer.get(`/api/orders/${first.body.id}`)).status).toBe(404);
});

test('continue payment reopens the same payment and holds nothing new', async () => {
  const { event, category } = await onSale();
  const order = (await checkout(buyer, category.id)).body;
  const res = await buyer.post(`/api/orders/${order.id}/continue-payment`);
  expect(res.status).toBe(200);
  expect(res.body).toEqual(order.payment);
  expect(await available(event.slug)).toBe(2);
});

test('an event or category with orders cannot be deleted', async () => {
  const { event, category } = await onSale();
  await checkout(buyer, category.id);
  const delCategory = await admin.delete(`/api/admin/categories/${category.id}`);
  expect(delCategory.status).toBe(409);
  expect(delCategory.body.error).toBe('has_orders');
  const delEvent = await admin.delete(`/api/admin/events/${event.id}`);
  expect(delEvent.status).toBe(409);
  expect(delEvent.body.error).toBe('has_orders');
});

test('capacity cannot be edited below the places held', async () => {
  const { category } = await onSale(3);
  await checkout(buyer, category.id);
  await checkout(buyer, category.id);
  const res = await admin.patch(`/api/admin/categories/${category.id}`).send({ capacity: 1 });
  expect(res.status).toBe(400);
  expect(res.body.fields).toEqual({
    capacity: "Capacity can't be below the 2 places already held or sold",
  });
  expect(
    (await admin.patch(`/api/admin/categories/${category.id}`).send({ capacity: 2 })).status,
  ).toBe(200);
});

test('a price edit leaves existing orders at the price they were bought for', async () => {
  const { category } = await onSale(3, 150000);
  const order = (await checkout(buyer, category.id)).body;
  await admin.patch(`/api/admin/categories/${category.id}`).send({ price: 200000 });
  expect((await buyer.get(`/api/orders/${order.id}`)).body.amount).toBe(150000);
  expect((await checkout(buyer, category.id)).body.amount).toBe(200000);
});
