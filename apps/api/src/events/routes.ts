import { and, asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { events, ticketCategories } from '../catalog/schema.ts';
import type { AppDeps } from '../deps.ts';
import { notFound } from '../http/errors.ts';
import type { EventCache } from './cache.ts';

/** What the cache holds: details that only change through an admin edit (which invalidates). */
type StableEvent = {
  id: string;
  slug: string;
  name: string;
  startsAt: string;
  venue: string;
  categories: { id: string; name: string; price: number; capacity: number }[];
};

async function readStableEvent(db: AppDeps['db'], slug: string): Promise<StableEvent | null> {
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.published, true)));
  if (!event) return null;
  const categories = await db
    .select({
      id: ticketCategories.id,
      name: ticketCategories.name,
      price: ticketCategories.price,
      capacity: ticketCategories.capacity,
    })
    .from(ticketCategories)
    .where(eq(ticketCategories.eventId, event.id))
    .orderBy(asc(ticketCategories.createdAt), asc(ticketCategories.name));
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    startsAt: event.startsAt.toISOString(),
    venue: event.venue,
    categories,
  };
}

/** Availability and sales state are never cached: a held place must show at once. */
async function readLiveAvailability(db: AppDeps['db'], eventId: string) {
  const rows = await db
    .select({
      id: ticketCategories.id,
      held: ticketCategories.held,
      capacity: ticketCategories.capacity,
      salesOpen: ticketCategories.salesOpen,
    })
    .from(ticketCategories)
    .where(eq(ticketCategories.eventId, eventId));
  return new Map(
    rows.map((r) => [r.id, { available: r.capacity - r.held, salesOpen: r.salesOpen }]),
  );
}

export function publicEventRoutes({ db }: AppDeps, cache: EventCache): Router {
  const router = Router();

  router.get('/events', async (_req, res) => {
    const rows = await db
      .select({
        slug: events.slug,
        name: events.name,
        startsAt: events.startsAt,
        venue: events.venue,
      })
      .from(events)
      .where(eq(events.published, true))
      .orderBy(asc(events.startsAt), asc(events.name));
    res.json(rows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString() })));
  });

  router.get('/events/:slug', async (req, res) => {
    const slug = req.params.slug;
    const cached = await cache.get<StableEvent>(slug);
    let event = cached.value;
    if (!event) {
      event = await readStableEvent(db, slug);
      if (!event) notFound();
      if (cached.state === 'miss') await cache.set(slug, event);
    }
    const live = await readLiveAvailability(db, event.id);
    res.set('X-Cache', cached.state);
    res.json({
      slug: event.slug,
      name: event.name,
      startsAt: event.startsAt,
      venue: event.venue,
      categories: event.categories
        .filter((c) => live.has(c.id))
        .map((c) => ({ ...c, ...live.get(c.id)! })),
    });
  });

  return router;
}
