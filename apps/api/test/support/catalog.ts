import type { Agent } from 'supertest';

let n = 0;
export function eventInput(overrides: Record<string, unknown> = {}) {
  n += 1;
  return {
    slug: `night-run-${Date.now()}-${n}`,
    name: 'Night Run',
    startsAt: '2026-12-06T19:00:00+07:00',
    venue: 'Gelora Bung Karno',
    ...overrides,
  };
}

/** Creates an event (optionally published) through the admin API and returns its body. */
export async function createEvent(
  admin: Agent,
  overrides: Record<string, unknown> = {},
  published = false,
) {
  const res = await admin.post('/api/admin/events').send(eventInput(overrides));
  if (res.status !== 201) throw new Error(`create event failed: ${res.status} ${res.text}`);
  if (!published) return res.body;
  const pub = await admin.patch(`/api/admin/events/${res.body.id}`).send({ published: true });
  return pub.body;
}

export async function createCategory(
  admin: Agent,
  eventId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await admin
    .post(`/api/admin/events/${eventId}/categories`)
    .send({ name: '12K', price: 150000, capacity: 3, ...overrides });
  if (res.status !== 201) throw new Error(`create category failed: ${res.status} ${res.text}`);
  return res.body;
}
