import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { reconcileExpired } from '../src/reconciliation/reconcile.ts';
import { freshTestApp, type TestApp } from './support/app.ts';
import { agentWithRole } from './support/auth.ts';
import { checkout } from './support/checkout.ts';
import { onSale, pendingOrder } from './support/sale.ts';

let t: TestApp;
beforeAll(async () => {
  t = await freshTestApp();
});
afterAll(() => t.close());

const ELEVEN_MINUTES = 11 * 60_000;
const available = async (slug: string) =>
  (await request(t.app).get(`/api/events/${slug}`)).body.categories[0].available;
const simulator = (orderId: string, action: string, body: object = {}) =>
  request(t.app).post(`/api/simulator/payments/${orderId}/${action}`).send(body);

test('after the payment window, reconciliation releases an unpaid place', async () => {
  const { buyer, category, event } = await onSale(t, 1);
  const order = await pendingOrder(buyer, category.id);
  expect(await available(event.slug)).toBe(0);

  t.clock.advance(ELEVEN_MINUTES);
  await reconcileExpired(t.deps);

  expect((await buyer.get(`/api/orders/${order.id}`)).body).toMatchObject({
    status: 'expired',
    holdReleased: true,
  });
  expect(await available(event.slug)).toBe(1);
});

test('before the deadline, reconciliation leaves the hold alone', async () => {
  const { buyer, category, event } = await onSale(t, 1);
  await pendingOrder(buyer, category.id);
  t.clock.advance(5 * 60_000);
  await reconcileExpired(t.deps);
  expect(await available(event.slug)).toBe(0);
});

test('an unknown payment outcome keeps the place held', async () => {
  const { buyer, category, event } = await onSale(t, 1);
  const order = await pendingOrder(buyer, category.id);
  await simulator(order.id, 'provider-status', { status: 'unknown' });

  t.clock.advance(ELEVEN_MINUTES);
  await reconcileExpired(t.deps);
  await reconcileExpired(t.deps);

  expect((await buyer.get(`/api/orders/${order.id}`)).body.status).toBe('pending');
  expect(await available(event.slug)).toBe(0);
});

test('reconciliation racing an expiry notification releases the place exactly once', async () => {
  const { buyer, category, event } = await onSale(t, 2);
  const order = await pendingOrder(buyer, category.id);
  t.clock.advance(ELEVEN_MINUTES);
  await Promise.all([
    reconcileExpired(t.deps),
    request(t.app)
      .post('/api/payments/notifications')
      .send({ orderId: order.id, status: 'expired' }),
    reconcileExpired(t.deps),
    request(t.app)
      .post('/api/payments/notifications')
      .send({ orderId: order.id, status: 'expired' }),
  ]);
  expect(await available(event.slug)).toBe(2);
});

test('a failed payment releases the place once, however often it is reported', async () => {
  const { buyer, category, event } = await onSale(t, 2);
  const order = await pendingOrder(buyer, category.id);
  await simulator(order.id, 'fail');
  await simulator(order.id, 'fail');
  expect((await buyer.get(`/api/orders/${order.id}`)).body.status).toBe('failed');
  expect(await available(event.slug)).toBe(2);
});

test('a payment after the hold was released goes to payment review; the new owner keeps their ticket', async () => {
  const { buyer, category, event } = await onSale(t, 1);
  const late = await pendingOrder(buyer, category.id);
  t.clock.advance(ELEVEN_MINUTES);
  await reconcileExpired(t.deps);

  const second = await agentWithRole(t, 'buyer');
  const taken = await pendingOrder(second, category.id, 'Second Buyer');
  await simulator(taken.id, 'pay');

  await simulator(late.id, 'pay');
  expect((await buyer.get(`/api/orders/${late.id}`)).body.status).toBe('payment_review');
  expect((await buyer.get('/api/tickets')).body).toEqual([]);
  expect((await second.get('/api/tickets')).body).toHaveLength(1);
  expect(await available(event.slug)).toBe(0);
});

test('the buyer returning from payment triggers a status check for their order', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  // The provider recorded a payment but its notification never arrived.
  await simulator(order.id, 'provider-status', { status: 'paid' });
  const res = await buyer.post(`/api/orders/${order.id}/refresh`);
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('paid');
  expect((await buyer.get('/api/tickets')).body).toHaveLength(1);

  const other = await agentWithRole(t, 'buyer');
  expect((await other.post(`/api/orders/${order.id}/refresh`)).status).toBe(404);
});

test('a late payment with no notification is found when the buyer returns, and goes to review', async () => {
  const { buyer, category, event } = await onSale(t, 1);
  const order = await pendingOrder(buyer, category.id);
  t.clock.advance(ELEVEN_MINUTES);
  expect((await buyer.post(`/api/orders/${order.id}/refresh`)).body.status).toBe('expired');

  // Paid after the release, and the provider's notification never arrived.
  await simulator(order.id, 'provider-status', { status: 'paid' });
  expect((await buyer.post(`/api/orders/${order.id}/refresh`)).body.status).toBe('payment_review');
  expect((await buyer.get('/api/tickets')).body).toEqual([]);
  expect(await available(event.slug)).toBe(1);
});

test('the simulator clock control moves expiry forward', async () => {
  const { buyer, category, event } = await onSale(t, 1);
  await pendingOrder(buyer, category.id);
  const res = await request(t.app).post('/api/simulator/clock/advance').send({ minutes: 11 });
  expect(res.status).toBe(200);
  await reconcileExpired(t.deps);
  expect(await available(event.slug)).toBe(1);
});

test('unpublishing or closing sales stops new checkouts, not existing payments', async () => {
  const { admin, buyer, category, event } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  await admin.patch(`/api/admin/categories/${category.id}`).send({ salesOpen: false });
  await admin.patch(`/api/admin/events/${event.id}`).send({ published: false });
  expect((await checkout(buyer, category.id)).status).toBe(409);
  await simulator(order.id, 'pay');
  expect((await buyer.get(`/api/orders/${order.id}`)).body.status).toBe('paid');
  expect((await buyer.get('/api/tickets')).body.length).toBeGreaterThan(0);
});

test('admins see payment review orders with their notifications; others cannot', async () => {
  const { admin, buyer, category } = await onSale(t, 1);
  const late = await pendingOrder(buyer, category.id, 'Late Payer');
  t.clock.advance(ELEVEN_MINUTES);
  await reconcileExpired(t.deps);
  await simulator(late.id, 'pay');

  const res = await admin.get('/api/admin/payment-reviews');
  expect(res.status).toBe(200);
  const review = res.body.find((r: { id: string }) => r.id === late.id);
  expect(review).toMatchObject({ participantName: 'Late Payer', status: 'payment_review' });
  expect(review.buyerEmail).toMatch(/@example\.com$/);
  expect(review.notifications.map((n: { status: string }) => n.status)).toContain('paid');
  expect((await buyer.get('/api/admin/payment-reviews')).status).toBe(403);
});
