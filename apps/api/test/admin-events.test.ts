import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { freshTestApp, type TestApp } from './support/app.ts';
import { agentWithRole } from './support/auth.ts';
import { createEvent, eventInput } from './support/catalog.ts';

let t: TestApp;
let admin: Agent;
beforeAll(async () => {
  t = await freshTestApp();
  admin = await agentWithRole(t, 'admin');
});
afterAll(() => t.close());

test('creates a draft event, storing the WIB start time as UTC', async () => {
  const input = eventInput({ startsAt: '2026-12-06T19:00:00+07:00' });
  const res = await admin.post('/api/admin/events').send(input);
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({
    slug: input.slug,
    name: 'Night Run',
    venue: 'Gelora Bung Karno',
    startsAt: '2026-12-06T12:00:00.000Z',
    published: false,
  });
  const list = await admin.get('/api/admin/events');
  expect(list.body.map((e: { id: string }) => e.id)).toContain(res.body.id);
});

test('lists drafts and published events ordered by start time', async () => {
  const later = await createEvent(admin, { startsAt: '2027-03-01T07:00:00+07:00' }, true);
  const earlier = await createEvent(admin, { startsAt: '2027-02-01T07:00:00+07:00' });
  const ids = (await admin.get('/api/admin/events')).body.map((e: { id: string }) => e.id);
  expect(ids.indexOf(earlier.id)).toBeLessThan(ids.indexOf(later.id));
});

test('rejects invalid input with one message per field', async () => {
  const res = await admin
    .post('/api/admin/events')
    .send({ slug: 'Night Run', name: '', startsAt: 'tomorrow', venue: '' });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('validation');
  expect(Object.keys(res.body.fields).sort()).toEqual(['name', 'slug', 'startsAt', 'venue']);
});

test('rejects a duplicate slug as a field error', async () => {
  const first = await createEvent(admin);
  const res = await admin.post('/api/admin/events').send(eventInput({ slug: first.slug }));
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'validation', fields: { slug: 'Slug is already taken' } });
});

test('two admins creating the same slug at once: one wins, one gets the field error', async () => {
  const input = eventInput();
  const results = await Promise.all([
    admin.post('/api/admin/events').send(input),
    admin.post('/api/admin/events').send(input),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
});

test('publishes and unpublishes', async () => {
  const event = await createEvent(admin);
  const pub = await admin.patch(`/api/admin/events/${event.id}`).send({ published: true });
  expect(pub.body.published).toBe(true);
  const unpub = await admin.patch(`/api/admin/events/${event.id}`).send({ published: false });
  expect(unpub.body.published).toBe(false);
});

test('locks the slug once the event is published', async () => {
  const event = await createEvent(admin, {}, true);
  const change = await admin.patch(`/api/admin/events/${event.id}`).send({ slug: 'another-slug' });
  expect(change.status).toBe(400);
  expect(change.body.fields).toEqual({ slug: "Slug can't change after the event is published" });
  const same = await admin
    .patch(`/api/admin/events/${event.id}`)
    .send({ slug: event.slug, name: 'Renamed' });
  expect(same.status).toBe(200);
  expect(same.body.name).toBe('Renamed');
});

test('edits name, venue and start time', async () => {
  const event = await createEvent(admin);
  const res = await admin
    .patch(`/api/admin/events/${event.id}`)
    .send({ name: 'Sunrise 10K', venue: 'Monas', startsAt: '2027-01-10T05:30:00+07:00' });
  expect(res.body).toMatchObject({
    name: 'Sunrise 10K',
    venue: 'Monas',
    startsAt: '2027-01-09T22:30:00.000Z',
  });
  expect((await admin.get(`/api/admin/events/${event.id}`)).body.name).toBe('Sunrise 10K');
});

test('deletes an event without orders', async () => {
  const event = await createEvent(admin);
  expect((await admin.delete(`/api/admin/events/${event.id}`)).status).toBe(204);
  expect((await admin.get(`/api/admin/events/${event.id}`)).status).toBe(404);
});

test('an id that is not a UUID is a 404', async () => {
  const res = await admin.get('/api/admin/events/abc');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'not_found' });
});

test('non-admins are refused every event management route', async () => {
  const event = await createEvent(admin);
  const buyer = await agentWithRole(t, 'buyer');
  const staff = await agentWithRole(t, 'staff');
  const calls = (a: Agent | ReturnType<typeof request>) => [
    a.get('/api/admin/events'),
    a.post('/api/admin/events').send(eventInput()),
    a.get(`/api/admin/events/${event.id}`),
    a.patch(`/api/admin/events/${event.id}`).send({ name: 'x' }),
    a.delete(`/api/admin/events/${event.id}`),
  ];
  for (const res of await Promise.all(calls(buyer))) expect(res.status).toBe(403);
  for (const res of await Promise.all(calls(staff))) expect(res.status).toBe(403);
  for (const res of await Promise.all(calls(request(t.app)))) expect(res.status).toBe(401);
});
