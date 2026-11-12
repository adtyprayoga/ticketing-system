import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { parseConfig } from '../src/config.ts';
import { buildTestApp, freshTestApp, type TestApp } from './support/app.ts';
import { onSale, pendingOrder } from './support/sale.ts';

let t: TestApp;
beforeAll(async () => {
  t = await freshTestApp();
});
afterAll(() => t.close());

test('the simulator shows the order it is paying for', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  const res = await request(t.app).get(`/api/simulator/payments/${order.id}`);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ orderId: order.id, amount: 150000, orderStatus: 'pending' });
});

test('paying in the simulator marks the order paid and issues one ticket', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id, 'Putri Participant');
  const pay = await request(t.app).post(`/api/simulator/payments/${order.id}/pay`).send({});
  expect(pay.status).toBe(200);
  expect((await buyer.get(`/api/orders/${order.id}`)).body.status).toBe('paid');
  const tickets = (await buyer.get('/api/tickets')).body;
  expect(tickets).toHaveLength(1);
  expect(tickets[0]).toMatchObject({ orderId: order.id, participantName: 'Putri Participant' });
});

test('the same notification sent twice still issues exactly one ticket', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  await request(t.app).post(`/api/simulator/payments/${order.id}/pay`).send({ notifications: 2 });
  expect((await buyer.get('/api/tickets')).body).toHaveLength(1);
});

test('parallel duplicate webhook calls issue exactly one ticket', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  const notification = { orderId: order.id, status: 'paid' };
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      request(t.app).post('/api/payments/notifications').send(notification),
    ),
  );
  expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
  expect((await buyer.get('/api/tickets')).body).toHaveLength(1);
  expect((await buyer.get(`/api/orders/${order.id}`)).body.status).toBe('paid');
});

test('a malformed notification is rejected', async () => {
  const res = await request(t.app).post('/api/payments/notifications').send({ orderId: 'x' });
  expect(res.status).toBe(400);
});

test('a paid order keeps its place: availability stays reduced', async () => {
  const { buyer, category, event } = await onSale(t, 3);
  const order = await pendingOrder(buyer, category.id);
  await request(t.app).post(`/api/simulator/payments/${order.id}/pay`).send({});
  const res = await request(t.app).get(`/api/events/${event.slug}`);
  expect(res.body.categories[0].available).toBe(2);
});

// Production can't run the simulator at all: config.test.ts.
test('simulator routes do not exist with the midtrans provider', async () => {
  const other = await buildTestApp({
    config: parseConfig({
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      REDIS_URL: process.env.TEST_REDIS_URL,
      PAYMENT_PROVIDER: 'midtrans',
      MIDTRANS_SERVER_KEY: 'SB-Mid-server-test',
    }),
  });
  try {
    const res = await request(other.app).get(
      '/api/simulator/payments/00000000-0000-4000-8000-000000000000',
    );
    expect(res.status).toBe(404);
  } finally {
    await other.close();
  }
});
