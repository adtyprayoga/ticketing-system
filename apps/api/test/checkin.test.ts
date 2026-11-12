import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { assignStaff } from '../src/staff/assign.ts';
import { freshTestApp, type TestApp } from './support/app.ts';
import { agentWithRole, uniqueEmail } from './support/auth.ts';
import { createCategory, createEvent } from './support/catalog.ts';
import { onSale, pendingOrder } from './support/sale.ts';

let t: TestApp;
beforeAll(async () => {
  t = await freshTestApp();
});
afterAll(() => t.close());

/** A paid ticket for an event, and a staff member assigned to that event. */
async function paidTicket(participantName = 'Putri Participant') {
  const sale = await onSale(t);
  const order = await pendingOrder(sale.buyer, sale.category.id, participantName);
  await request(t.app).post(`/api/simulator/payments/${order.id}/pay`).send({});
  const [ticket] = (await sale.buyer.get('/api/tickets')).body;
  const staffEmail = uniqueEmail('staff');
  const staff = await agentWithRole(t, 'staff', staffEmail);
  await assignStaff(t.deps.db, { eventSlug: sale.event.slug, email: staffEmail });
  return { ...sale, ticket, staff, staffEmail };
}

const lookup = (staff: Agent, eventId: string, code: string) =>
  staff.get(`/api/staff/events/${eventId}/tickets/${encodeURIComponent(code)}`);
const confirm = (staff: Agent, eventId: string, code: string) =>
  staff.post(`/api/staff/events/${eventId}/tickets/${encodeURIComponent(code)}/check-in`);

test('staff see only the events they are assigned to', async () => {
  const { staff, event } = await paidTicket();
  const res = await staff.get('/api/staff/events');
  expect(res.body.map((e: { id: string }) => e.id)).toEqual([event.id]);
});

test('a lookup shows the participant, category and status, and changes nothing', async () => {
  const { staff, event, ticket } = await paidTicket('Putri Participant');
  const first = await lookup(staff, event.id, ticket.lookupCode);
  expect(first.status).toBe(200);
  expect(first.body).toEqual({
    participantName: 'Putri Participant',
    categoryName: '12K',
    checkedInAt: null,
    checkedInBy: null,
  });
  await lookup(staff, event.id, ticket.lookupCode);
  expect((await lookup(staff, event.id, ticket.lookupCode)).body.checkedInAt).toBeNull();
});

test('codes match whatever the case, dashes or spaces', async () => {
  const { staff, event, ticket } = await paidTicket();
  const typed = ticket.lookupCode.toLowerCase().replace(/-/g, ' ');
  expect((await lookup(staff, event.id, typed)).status).toBe(200);
});

test('confirming check-in records who admitted the participant and when', async () => {
  const { staff, event, ticket } = await paidTicket();
  const res = await confirm(staff, event.id, ticket.lookupCode);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    result: 'checked_in',
    checkedInAt: t.clock.now().toISOString(),
    checkedInBy: { name: 'Test User' },
  });
  expect((await lookup(staff, event.id, ticket.lookupCode)).body.checkedInAt).toBe(
    res.body.checkedInAt,
  );
});

test('two staff confirming the same ticket at once: exactly one check-in', async () => {
  const { staff, event, ticket, staffEmail: _ } = await paidTicket();
  const colleagueEmail = uniqueEmail('staff');
  const colleague = await agentWithRole(t, 'staff', colleagueEmail);
  await assignStaff(t.deps.db, { eventSlug: event.slug, email: colleagueEmail });

  const results = await Promise.all([
    confirm(staff, event.id, ticket.lookupCode),
    confirm(colleague, event.id, ticket.lookupCode),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const winner = results.find((r) => r.status === 200)!;
  const loser = results.find((r) => r.status === 409)!;
  expect(loser.body).toMatchObject({
    error: 'already_checked_in',
    checkedInAt: winner.body.checkedInAt,
    checkedInBy: winner.body.checkedInBy,
  });
});

test('staff not assigned to the event are refused', async () => {
  const { event, ticket } = await paidTicket();
  const outsider = await agentWithRole(t, 'staff');
  expect((await lookup(outsider, event.id, ticket.lookupCode)).status).toBe(403);
  expect((await confirm(outsider, event.id, ticket.lookupCode)).status).toBe(403);
});

test('a ticket for another event shows no participant details', async () => {
  const { staff, staffEmail, admin } = await paidTicket('Other Event Person');
  const other = await paidTicket('Someone Else');
  const event = await createEvent(admin, {}, true);
  await createCategory(admin, event.id);
  await assignStaff(t.deps.db, { eventSlug: event.slug, email: staffEmail });
  const res = await lookup(staff, event.id, other.ticket.lookupCode);
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'other_event', message: 'Not a ticket for this event' });
  expect((await confirm(staff, event.id, other.ticket.lookupCode)).status).toBe(404);
});

test('an unknown code is not found', async () => {
  const { staff, event } = await paidTicket();
  const res = await lookup(staff, event.id, 'AAAA-BBBB-CCCC-DDDD');
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('not_found');
});

test('buyers and admins cannot use staff check-in', async () => {
  const { event, ticket, buyer, admin } = await paidTicket();
  expect((await lookup(buyer, event.id, ticket.lookupCode)).status).toBe(403);
  expect((await confirm(admin, event.id, ticket.lookupCode)).status).toBe(403);
});
