import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createRedis } from '../src/redis.ts';
import { buildTestApp, freshTestApp, type TestApp } from './support/app.ts';
import { agentWithRole } from './support/auth.ts';
import { createCategory, createEvent } from './support/catalog.ts';

let t: TestApp;
let admin: Agent;
beforeAll(async () => {
  t = await freshTestApp();
  admin = await agentWithRole(t, 'admin');
});
afterAll(() => t.close());

async function publishedEventWithCategory() {
  const event = await createEvent(admin, { name: 'Jakarta Night Run' }, true);
  const category = await createCategory(admin, event.id, {
    name: '12K',
    price: 150000,
    capacity: 3,
  });
  return { event, category };
}

test('a visitor reads a published event: a miss, then a hit', async () => {
  const { event, category } = await publishedEventWithCategory();
  const first = await request(t.app).get(`/api/events/${event.slug}`);
  expect(first.status).toBe(200);
  expect(first.headers['x-cache']).toBe('miss');
  expect(first.body).toEqual({
    slug: event.slug,
    name: 'Jakarta Night Run',
    startsAt: '2026-12-06T12:00:00.000Z',
    venue: 'Gelora Bung Karno',
    categories: [
      { id: category.id, name: '12K', price: 150000, capacity: 3, available: 3, salesOpen: true },
    ],
  });
  const second = await request(t.app).get(`/api/events/${event.slug}`);
  expect(second.headers['x-cache']).toBe('hit');
  expect(second.body).toEqual(first.body);
});

test('a draft or unknown event is not found', async () => {
  const draft = await createEvent(admin);
  expect((await request(t.app).get(`/api/events/${draft.slug}`)).status).toBe(404);
  expect((await request(t.app).get('/api/events/no-such-event')).status).toBe(404);
});

test('event details still load when redis is down', async () => {
  const { event } = await publishedEventWithCategory();
  const down = await buildTestApp({ redis: createRedis('redis://127.0.0.1:1') });
  try {
    const res = await request(down.app).get(`/api/events/${event.slug}`);
    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('bypass');
    expect(res.body.name).toBe('Jakarta Night Run');
  } finally {
    await down.close();
  }
});

test('an admin edit shows on the next read (the cached copy is dropped)', async () => {
  const { event, category } = await publishedEventWithCategory();
  await request(t.app).get(`/api/events/${event.slug}`);
  await admin.patch(`/api/admin/events/${event.id}`).send({ name: 'Renamed Run' });
  const afterEventEdit = await request(t.app).get(`/api/events/${event.slug}`);
  expect(afterEventEdit.headers['x-cache']).toBe('miss');
  expect(afterEventEdit.body.name).toBe('Renamed Run');

  await admin.patch(`/api/admin/categories/${category.id}`).send({ price: 175000 });
  const afterCategoryEdit = await request(t.app).get(`/api/events/${event.slug}`);
  expect(afterCategoryEdit.headers['x-cache']).toBe('miss');
  expect(afterCategoryEdit.body.categories[0].price).toBe(175000);
});

test('unpublishing hides the event even after it was cached', async () => {
  const { event } = await publishedEventWithCategory();
  await request(t.app).get(`/api/events/${event.slug}`);
  await admin.patch(`/api/admin/events/${event.id}`).send({ published: false });
  expect((await request(t.app).get(`/api/events/${event.slug}`)).status).toBe(404);
});

test('a closed ticket category is marked, not hidden', async () => {
  const { event, category } = await publishedEventWithCategory();
  await admin.patch(`/api/admin/categories/${category.id}`).send({ salesOpen: false });
  const res = await request(t.app).get(`/api/events/${event.slug}`);
  expect(res.body.categories[0]).toMatchObject({ id: category.id, salesOpen: false });
});

test('the public list shows published events only, soonest first', async () => {
  const later = await createEvent(
    admin,
    { name: 'Later Run', startsAt: '2027-05-01T06:00:00+07:00' },
    true,
  );
  const sooner = await createEvent(
    admin,
    { name: 'Sooner Run', startsAt: '2027-04-01T06:00:00+07:00' },
    true,
  );
  const draft = await createEvent(admin, { name: 'Draft Run' });
  const res = await request(t.app).get('/api/events');
  const slugs = res.body.map((e: { slug: string }) => e.slug);
  expect(slugs).not.toContain(draft.slug);
  expect(slugs.indexOf(sooner.slug)).toBeLessThan(slugs.indexOf(later.slug));
});
