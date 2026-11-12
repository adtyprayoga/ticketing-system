import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { freshTestApp, type TestApp } from './support/app.ts';
import { agentWithRole } from './support/auth.ts';
import { onSale, pendingOrder } from './support/sale.ts';

let t: TestApp;
beforeAll(async () => {
  t = await freshTestApp();
});
afterAll(() => t.close());

test('a paid ticket shows the participant, category, event and a readable code', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id, 'Putri Participant');
  await request(t.app).post(`/api/simulator/payments/${order.id}/pay`).send({});
  const [ticket] = (await buyer.get('/api/tickets')).body;
  expect(ticket).toMatchObject({
    participantName: 'Putri Participant',
    categoryName: '12K',
    eventName: 'Pay Run',
    venue: 'Gelora Bung Karno',
    checkedInAt: null,
  });
  expect(ticket.lookupCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
});

test('a buyer sees only their own tickets', async () => {
  const { buyer, category } = await onSale(t);
  const order = await pendingOrder(buyer, category.id);
  await request(t.app).post(`/api/simulator/payments/${order.id}/pay`).send({});
  const other = await agentWithRole(t, 'buyer');
  expect((await other.get('/api/tickets')).body).toEqual([]);
  expect((await request(t.app).get('/api/tickets')).status).toBe(401);
});

test('an unpaid order has no ticket', async () => {
  const { buyer, category } = await onSale(t);
  await pendingOrder(buyer, category.id);
  expect((await buyer.get('/api/tickets')).body).toEqual([]);
});

test('every ticket gets a different code', async () => {
  const { buyer, category } = await onSale(t, 5);
  for (let i = 0; i < 5; i++) {
    const order = await pendingOrder(buyer, category.id);
    await request(t.app).post(`/api/simulator/payments/${order.id}/pay`).send({});
  }
  const codes = (await buyer.get('/api/tickets')).body.map(
    (x: { lookupCode: string }) => x.lookupCode,
  );
  expect(new Set(codes).size).toBe(5);
});
