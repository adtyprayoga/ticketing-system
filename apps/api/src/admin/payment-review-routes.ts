import { asc, desc, eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import { user } from '../auth/schema.ts';
import { events, ticketCategories } from '../catalog/schema.ts';
import type { AppDeps } from '../deps.ts';
import { toOrderView } from '../orders/routes.ts';
import { orders } from '../orders/schema.ts';
import { paymentNotifications } from '../payments/schema.ts';

/** Read-only list of late payments that need support. Mounted under /api/admin. */
export function paymentReviewRoutes({ db }: AppDeps): Router {
  const router = Router();
  router.get('/payment-reviews', async (_req, res) => {
    const rows = await db
      .select({
        order: orders,
        categoryName: ticketCategories.name,
        eventName: events.name,
        eventSlug: events.slug,
        eventStartsAt: events.startsAt,
        buyerEmail: user.email,
      })
      .from(orders)
      .innerJoin(ticketCategories, eq(ticketCategories.id, orders.categoryId))
      .innerJoin(events, eq(events.id, ticketCategories.eventId))
      .innerJoin(user, eq(user.id, orders.buyerId))
      .where(eq(orders.status, 'payment_review'))
      .orderBy(desc(orders.updatedAt));
    const notes = rows.length
      ? await db
          .select()
          .from(paymentNotifications)
          .where(
            inArray(
              paymentNotifications.orderId,
              rows.map((r) => r.order.id),
            ),
          )
          .orderBy(asc(paymentNotifications.receivedAt))
      : [];
    res.json(
      rows.map((r) => ({
        ...toOrderView(r),
        buyerEmail: r.buyerEmail,
        holdReleasedAt: r.order.holdReleasedAt?.toISOString() ?? null,
        notifications: notes
          .filter((n) => n.orderId === r.order.id)
          .map((n) => ({
            provider: n.provider,
            status: n.status,
            receivedAt: n.receivedAt.toISOString(),
            raw: n.raw,
          })),
      })),
    );
  });
  return router;
}
