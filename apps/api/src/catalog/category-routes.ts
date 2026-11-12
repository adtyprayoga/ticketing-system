import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDeps } from '../deps.ts';
import { fieldError, notFound } from '../http/errors.ts';
import { isForeignKeyViolation, uuidParam } from '../http/params.ts';
import { body, validateBody } from '../http/validate.ts';
import { orders } from '../orders/schema.ts';
import { findEvent, hasOrders } from './event-routes.ts';
import { events, ticketCategories } from './schema.ts';

const name = z.string().trim().min(1, 'Enter a name').max(60, 'Use at most 60 characters');
const price = z
  .number({ message: 'Enter a price in whole rupiah' })
  .int('Use whole rupiah')
  .positive('Price must be more than zero')
  .max(100_000_000, 'Price is too high');
const capacity = z
  .number({ message: 'Enter a capacity' })
  .int('Use a whole number')
  .positive('Capacity must be at least 1')
  .max(100_000, 'Capacity is too high');

const createCategory = z.object({ name, price, capacity });
const updateCategory = z.object({
  name: name.optional(),
  price: price.optional(),
  capacity: capacity.optional(),
  salesOpen: z.boolean().optional(),
});

type CategoryRow = typeof ticketCategories.$inferSelect;

export function toAdminCategory(c: CategoryRow) {
  return {
    id: c.id,
    eventId: c.eventId,
    name: c.name,
    price: c.price,
    capacity: c.capacity,
    held: c.held,
    salesOpen: c.salesOpen,
  };
}

/** Admin ticket category management: the second half of the CRUD lab. Mounted under /api/admin. */
export function adminCategoryRoutes(
  deps: AppDeps,
  hooks: { onEventChanged(slug: string): Promise<void> },
) {
  const { db, clock } = deps;
  const router = Router();

  async function findCategory(id: string) {
    const [row] = await db
      .select({ category: ticketCategories, eventSlug: events.slug })
      .from(ticketCategories)
      .innerJoin(events, eq(events.id, ticketCategories.eventId))
      .where(eq(ticketCategories.id, id));
    return row ?? notFound();
  }

  router.get('/events/:eventId/categories', async (req, res) => {
    const event = await findEvent(db, uuidParam(req, 'eventId'));
    const rows = await db
      .select()
      .from(ticketCategories)
      .where(eq(ticketCategories.eventId, event.id))
      .orderBy(asc(ticketCategories.createdAt), asc(ticketCategories.name));
    res.json(rows.map(toAdminCategory));
  });

  router.post('/events/:eventId/categories', validateBody(createCategory), async (req, res) => {
    const event = await findEvent(db, uuidParam(req, 'eventId'));
    const input = body<z.infer<typeof createCategory>>(res);
    const now = clock.now();
    const [row] = await db
      .insert(ticketCategories)
      .values({ ...input, eventId: event.id, createdAt: now, updatedAt: now })
      .returning();
    await hooks.onEventChanged(event.slug);
    res.status(201).json(toAdminCategory(row!));
  });

  router.patch('/categories/:id', validateBody(updateCategory), async (req, res) => {
    const id = uuidParam(req, 'id');
    const input = body<z.infer<typeof updateCategory>>(res);
    const { eventSlug } = await findCategory(id);
    // One guarded statement: a concurrent hold can't slip in between a check and the update.
    const [row] = await db
      .update(ticketCategories)
      .set({ ...input, updatedAt: clock.now() })
      .where(
        input.capacity === undefined
          ? eq(ticketCategories.id, id)
          : and(eq(ticketCategories.id, id), gte(sql`${input.capacity}`, ticketCategories.held)),
      )
      .returning();
    if (!row) {
      const { category } = await findCategory(id);
      fieldError(
        'capacity',
        `Capacity can't be below the ${category.held} places already held or sold`,
      );
    }
    await hooks.onEventChanged(eventSlug);
    res.json(toAdminCategory(row));
  });

  router.delete('/categories/:id', async (req, res) => {
    const { category, eventSlug } = await findCategory(uuidParam(req, 'id'));
    const [withOrders] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.categoryId, category.id))
      .limit(1);
    if (withOrders) hasOrders('ticket category');
    await db
      .delete(ticketCategories)
      .where(eq(ticketCategories.id, category.id))
      .catch((err) =>
        isForeignKeyViolation(err) ? hasOrders('ticket category') : Promise.reject(err),
      );
    await hooks.onEventChanged(eventSlug);
    res.status(204).end();
  });

  return router;
}
