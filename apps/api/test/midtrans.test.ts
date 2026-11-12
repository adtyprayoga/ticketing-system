import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { parseConfig } from '../src/config.ts';
import { createMidtransProvider, verifySignature } from '../src/payments/midtrans.ts';
import { createDb } from '../src/db/client.ts';
import { buildTestApp, testClock, type TestApp } from './support/app.ts';
import { resetDatabase } from './support/db.ts';
import { fakeMidtrans, SERVER_KEY, signedNotification } from './support/fake-midtrans.ts';
import { onSale, pendingOrder } from './support/sale.ts';

let t: TestApp;
let midtrans: ReturnType<typeof fakeMidtrans>;
let pool: { end(): Promise<void> };
beforeAll(async () => {
  midtrans = fakeMidtrans();
  const config = parseConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    REDIS_URL: process.env.TEST_REDIS_URL,
    PAYMENT_PROVIDER: 'midtrans',
    MIDTRANS_SERVER_KEY: SERVER_KEY,
    WEB_ORIGIN: 'http://localhost:3000',
  });
  const own = createDb(config.databaseUrl);
  pool = own.pool;
  await resetDatabase(own.db);
  const clock = testClock();
  const payments = createMidtransProvider({ db: own.db, clock, config, fetch: midtrans.fetch });
  t = await buildTestApp({ config, db: own.db, clock, payments });
});
afterAll(async () => {
  await t.close();
  await pool.end();
});

const ELEVEN_MINUTES = 11 * 60_000;
const notify = (body: object) => request(t.app).post('/api/payments/notifications').send(body);

test('the signature check matches a reference computed with openssl', () => {
  const payload = {
    order_id: 'a1b2c3d4-0000-4000-8000-000000000001',
    status_code: '200',
    gross_amount: '15000.00',
  };
  const reference =
    'c8666bdd54af9b8175d55d41b25e778fe26f74d38404ef2957d163906b4499dd0aedd09845fd7e31c3f87dec39bfff8b6e076828b4c00cbc25bdcd2c0d51ba8f';
  expect(verifySignature({ ...payload, signature_key: reference }, SERVER_KEY)).toBe(true);
  expect(
    verifySignature({ ...payload, signature_key: reference.replace('c8', 'c9') }, SERVER_KEY),
  ).toBe(false);
});

test('checkout opens a Snap transaction for the order with a 10-minute expiry', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  const call = midtrans.calls.find((c) => c.url.endsWith('/snap/v1/transactions'))!;
  expect(call.url).toBe('https://app.sandbox.midtrans.com/snap/v1/transactions');
  expect(call.headers.authorization).toBe(
    `Basic ${Buffer.from(`${SERVER_KEY}:`).toString('base64')}`,
  );
  expect(call.body).toEqual({
    transaction_details: { order_id: order.id, gross_amount: 150000 },
    expiry: { start_time: '2026-11-15 07:00:00 +0700', unit: 'minutes', duration: 10 },
    callbacks: { finish: `http://localhost:3000/orders/${order.id}/return` },
  });
  expect((await buyer.get(`/api/orders/${order.id}`)).body.payment.redirectUrl).toBe(
    `https://app.sandbox.midtrans.com/snap/v4/redirection/snap-${order.id}`,
  );
});

test('a Snap transaction opened late by "Continue payment" still closes at the order deadline', async () => {
  const { buyer, category } = await onSale(t);
  midtrans.failSnap(1);
  const order = await pendingOrder(buyer, category.id);
  expect(order.payment).toBeNull();
  const created = new Date(order.createdAt);

  t.clock.advance(6 * 60_000);
  const res = await buyer.post(`/api/orders/${order.id}/continue-payment`);
  expect(res.status).toBe(200);
  const call = midtrans.calls.findLast((c) => c.url.endsWith('/snap/v1/transactions'))!;
  const startWib = new Date(created.getTime() + 7 * 3600_000).toISOString();
  expect((call.body as { expiry: unknown }).expiry).toEqual({
    start_time: `${startWib.slice(0, 10)} ${startWib.slice(11, 19)} +0700`,
    unit: 'minutes',
    duration: 10,
  });
});

test('"Continue payment" after the deadline is refused', async () => {
  const { buyer, category } = await onSale(t);
  midtrans.failSnap(1);
  const order = await pendingOrder(buyer, category.id);
  t.clock.advance(ELEVEN_MINUTES);
  const res = await buyer.post(`/api/orders/${order.id}/continue-payment`);
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('payment_window_closed');
});

test('continue payment reuses the same Snap transaction', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  const before = midtrans.calls.length;
  const res = await buyer.post(`/api/orders/${order.id}/continue-payment`);
  expect(res.body.redirectUrl).toContain(`snap-${order.id}`);
  expect(midtrans.calls.length).toBe(before);
});

test('a notification with a bad signature is refused and changes nothing', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  const forged = {
    ...signedNotification(order.id, 150000, { transaction_status: 'settlement' }),
    signature_key: 'f'.repeat(128),
  };
  const res = await notify(forged);
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ error: 'invalid_signature' });
  expect((await buyer.get(`/api/orders/${order.id}`)).body.status).toBe('pending');
});

test("a signed notification for an order that isn't ours (Midtrans's dashboard test) is acknowledged", async () => {
  const res = await notify(
    signedNotification(`payment_notif_test_G123_${crypto.randomUUID()}`, 10000, {
      transaction_status: 'settlement',
    }),
  );
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});

test.each([
  [{ transaction_status: 'settlement' }, 'paid'],
  [{ transaction_status: 'capture', fraud_status: 'accept' }, 'paid'],
  [{ transaction_status: 'pending' }, 'pending'],
  [{ transaction_status: 'deny' }, 'pending'],
  [{ transaction_status: 'expire', status_code: '407' }, 'expired'],
  [{ transaction_status: 'cancel' }, 'failed'],
  [{ transaction_status: 'capture', fraud_status: 'challenge' }, 'pending'],
  [{ transaction_status: 'refund' }, 'pending'],
])('notification %o leaves the order %s', async (fields, expected) => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  const res = await notify(signedNotification(order.id, 150000, fields));
  expect(res.status).toBe(200);
  expect((await buyer.get(`/api/orders/${order.id}`)).body.status).toBe(expected);
});

test('returning from Snap asks the Status API; redirect parameters alone change nothing', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  midtrans.setStatus(order.id, { status_code: '201', transaction_status: 'pending' });
  const tricked = await buyer
    .post(`/api/orders/${order.id}/refresh?transaction_status=settlement&status_code=200`)
    .send({ transaction_status: 'settlement' });
  expect(tricked.body.status).toBe('pending');
  expect((await buyer.get('/api/tickets')).body).toEqual([]);

  midtrans.setStatus(order.id, { status_code: '200', transaction_status: 'settlement' });
  const paid = await buyer.post(`/api/orders/${order.id}/refresh`);
  expect(paid.body.status).toBe('paid');
  expect((await buyer.get('/api/tickets')).body).toHaveLength(1);
});

test('an unreachable or failing Status API keeps the hold', async () => {
  const { buyer, category, event } = await onSale(t, 1);
  const order = await pendingOrder(buyer, category.id);
  t.clock.advance(ELEVEN_MINUTES);
  midtrans.setStatus(order.id, 'network-error');
  expect((await buyer.post(`/api/orders/${order.id}/refresh`)).body.status).toBe('pending');
  midtrans.setStatus(order.id, { status_message: 'error' }, 500);
  expect((await buyer.post(`/api/orders/${order.id}/refresh`)).body.status).toBe('pending');
  expect((await request(t.app).get(`/api/events/${event.slug}`)).body.categories[0].available).toBe(
    0,
  );
});

test('"transaction doesn\'t exist" stays pending until 5 minutes past the deadline, then expires', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  t.clock.advance(12 * 60_000);
  expect((await buyer.post(`/api/orders/${order.id}/refresh`)).body.status).toBe('pending');
  t.clock.advance(4 * 60_000);
  expect((await buyer.post(`/api/orders/${order.id}/refresh`)).body.status).toBe('expired');
});

test('"transaction doesn\'t exist" sent as HTTP 404 also expires 5 minutes past the deadline', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  midtrans.setStatus(
    order.id,
    { status_code: '404', status_message: "Transaction doesn't exist." },
    404,
  );
  t.clock.advance(12 * 60_000);
  expect((await buyer.post(`/api/orders/${order.id}/refresh`)).body.status).toBe('pending');
  t.clock.advance(4 * 60_000);
  expect((await buyer.post(`/api/orders/${order.id}/refresh`)).body.status).toBe('expired');
});
