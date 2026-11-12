import { asc, eq } from 'drizzle-orm';
import { isForeignKeyViolation } from '../http/params.ts';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDeps } from '../deps.ts';
import { conflict, fieldError, notFound } from '../http/errors.ts';
import { isUniqueViolation, uuidParam } from '../http/params.ts';
import { body, validateBody } from '../http/validate.ts';
import { orders } from '../orders/schema.ts';
import { events, ticketCategories } from './schema.ts';

const slug = z
  .string()
  .max(80, 'Use at most 80 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');
const name = z.string().trim().min(1, 'Enter a name').max(120, 'Use at most 120 characters');
const venue = z.string().trim().min(1, 'Enter a venue').max(120, 'Use at most 120 characters');
const startsAt = z.iso.datetime({ offset: true, message: 'Enter a date and time' });

const createEvent = z.object({ slug, name, startsAt, venue });
const updateEvent = z.object({
  slug: slug.optional(),
  name: name.optional(),
  startsAt: startsAt.optional(),
  venue: venue.optional(),
  published: z.boolean().optional(),
});

export type EventRow = typeof events.$inferSelect;

export function toAdminEvent(e: EventRow) {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    startsAt: e.startsAt.toISOString(),
    venue: e.venue,
    published: e.published,
  };
}

export async function findEvent(db: AppDeps['db'], id: string): Promise<EventRow> {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  return row ?? notFound();
}

export function hasOrders(what: 'event' | 'ticket category'): never {
  conflict(
    'has_orders',
    `This ${what} has orders, so it can't be deleted. ${what === 'event' ? 'Unpublish it' : 'Close its sales'} instead.`,
  );
}

function slugTaken(err: unknown): never {
  if (isUniqueViolation(err, 'events_slug_unique')) fieldError('slug', 'Slug is already taken');
  throw err;
}

/** Admin event management: the first half of the workshop's CRUD lab. Mounted under /api/admin. */
export function adminEventRoutes(
  deps: AppDeps,
  hooks: { onEventChanged(slug: string): Promise<void> },
) {
  const { db, clock } = deps;
  const router = Router();

  router.get('/events', async (_req, res) => {
    const rows = await db.select().from(events).orderBy(asc(events.startsAt), asc(events.name));
    res.json(rows.map(toAdminEvent));
  });

  router.post('/events', validateBody(createEvent), async (_req, res) => {
    const input = body<z.infer<typeof createEvent>>(res);
    const now = clock.now();
    const [row] = await db
      .insert(events)
      .values({ ...input, startsAt: new Date(input.startsAt), createdAt: now, updatedAt: now })
      .returning()
      .catch(slugTaken);
    res.status(201).json(toAdminEvent(row!));
  });

  router.get('/events/:id', async (req, res) => {
    res.json(toAdminEvent(await findEvent(db, uuidParam(req, 'id'))));
  });

  router.patch('/events/:id', validateBody(updateEvent), async (req, res) => {
    const id = uuidParam(req, 'id');
    const input = body<z.infer<typeof updateEvent>>(res);
    const current = await findEvent(db, id);
    if (input.slug !== undefined && input.slug !== current.slug && current.published) {
      fieldError('slug', "Slug can't change after the event is published");
    }
    const [row] = await db
      .update(events)
      .set({
        ...input,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        updatedAt: clock.now(),
      })
      .where(eq(events.id, id))
      .returning()
      .catch(slugTaken);
    await hooks.onEventChanged(current.slug);
    res.json(toAdminEvent(row!));
  });

  router.delete('/events/:id', async (req, res) => {
    const event = await findEvent(db, uuidParam(req, 'id'));
    const [withOrders] = await db
      .select({ id: orders.id })
      .from(orders)
      .innerJoin(ticketCategories, eq(ticketCategories.id, orders.categoryId))
      .where(eq(ticketCategories.eventId, event.id))
      .limit(1);
    if (withOrders) hasOrders('event');
    await db
      .delete(events)
      .where(eq(events.id, event.id))
      .catch((err) => (isForeignKeyViolation(err) ? hasOrders('event') : Promise.reject(err)));
    await hooks.onEventChanged(event.slug);
    res.status(204).end();
  });

  return router;
}
