import { desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { currentUser, type Guards } from '../auth/session.ts';
import { events, ticketCategories } from '../catalog/schema.ts';
import type { AppDeps } from '../deps.ts';
import { orders } from '../orders/schema.ts';
import { formatLookupCode } from './lookup-code.ts';
import { tickets } from './schema.ts';

export function ticketRoutes({ db }: AppDeps, { requireSession }: Guards): Router {
  const router = Router();

  /** The signed-in buyer's tickets. */
  router.get('/tickets', requireSession, async (_req, res) => {
    const rows = await db
      .select({
        id: tickets.id,
        orderId: tickets.orderId,
        lookupCode: tickets.lookupCode,
        checkedInAt: tickets.checkedInAt,
        participantName: orders.participantName,
        categoryName: ticketCategories.name,
        eventName: events.name,
        eventStartsAt: events.startsAt,
        venue: events.venue,
      })
      .from(tickets)
      .innerJoin(orders, eq(orders.id, tickets.orderId))
      .innerJoin(ticketCategories, eq(ticketCategories.id, orders.categoryId))
      .innerJoin(events, eq(events.id, ticketCategories.eventId))
      .where(eq(orders.buyerId, currentUser(res).id))
      .orderBy(desc(tickets.createdAt));
    res.json(
      rows.map((r) => ({
        ...r,
        lookupCode: formatLookupCode(r.lookupCode),
        checkedInAt: r.checkedInAt?.toISOString() ?? null,
        eventStartsAt: r.eventStartsAt.toISOString(),
      })),
    );
  });

  return router;
}
