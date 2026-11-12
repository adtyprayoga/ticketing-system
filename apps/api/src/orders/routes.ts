import { desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { currentUser, type Guards } from '../auth/session.ts';
import { events, ticketCategories } from '../catalog/schema.ts';
import { holdPlace } from '../checkout/hold.ts';
import type { AppDeps } from '../deps.ts';
import { conflict, notFound } from '../http/errors.ts';
import { reconcileOrder } from '../reconciliation/reconcile.ts';
import { uuidParam } from '../http/params.ts';
import { body, validateBody } from '../http/validate.ts';
import { orders, type OrderRow } from './schema.ts';

const checkoutInput = z.object({
  categoryId: z.uuid('Choose a ticket category'),
  participantName: z
    .string()
    .trim()
    .min(1, "Enter the participant's name")
    .max(80, 'Use at most 80 characters'),
  attemptKey: z.uuid('Missing checkout attempt'),
});

const orderColumns = {
  order: orders,
  categoryName: ticketCategories.name,
  eventName: events.name,
  eventSlug: events.slug,
  eventStartsAt: events.startsAt,
};

type OrderWithNames = {
  order: OrderRow;
  categoryName: string;
  eventName: string;
  eventSlug: string;
  eventStartsAt: Date;
};

export function toOrderView({
  order,
  categoryName,
  eventName,
  eventSlug,
  eventStartsAt,
}: OrderWithNames) {
  return {
    id: order.id,
    status: order.status,
    eventName,
    eventSlug,
    eventStartsAt: eventStartsAt.toISOString(),
    categoryName,
    participantName: order.participantName,
    amount: order.amount,
    paymentDeadline: order.paymentDeadline.toISOString(),
    holdReleased: order.holdReleasedAt !== null,
    payment: order.paymentRedirectUrl ? { redirectUrl: order.paymentRedirectUrl } : null,
    createdAt: order.createdAt.toISOString(),
  };
}

export async function findOrderWithNames(db: AppDeps['db'], orderId: string) {
  const [row] = await db
    .select(orderColumns)
    .from(orders)
    .innerJoin(ticketCategories, eq(ticketCategories.id, orders.categoryId))
    .innerJoin(events, eq(events.id, ticketCategories.eventId))
    .where(eq(orders.id, orderId));
  return row;
}

/** Starts a payment with the provider unless the order already has one. */
async function ensurePayment(deps: AppDeps, order: OrderRow): Promise<OrderRow> {
  if (order.paymentRedirectUrl) return order;
  const payment = await deps.payments.createPayment({
    orderId: order.id,
    amount: order.amount,
    deadline: order.paymentDeadline,
  });
  const [updated] = await deps.db
    .update(orders)
    .set({
      paymentToken: payment.token,
      paymentRedirectUrl: payment.redirectUrl,
      updatedAt: deps.clock.now(),
    })
    .where(eq(orders.id, order.id))
    .returning();
  return updated!;
}

export function orderRoutes(deps: AppDeps, { requireSession }: Guards): Router {
  const { db } = deps;
  const router = Router();

  async function ownOrder(orderId: string, buyerId: string) {
    const row = await findOrderWithNames(db, orderId);
    if (!row || row.order.buyerId !== buyerId) notFound();
    return row;
  }

  router.post('/checkout', requireSession, validateBody(checkoutInput), async (_req, res) => {
    const input = body<z.infer<typeof checkoutInput>>(res);
    const { order, created } = await holdPlace(deps, { ...input, buyerId: currentUser(res).id });
    if (created) {
      // The place is held either way; if the provider is down, "Continue payment" retries this.
      await ensurePayment(deps, order).catch((err) => console.error('createPayment failed:', err));
    }
    const view = toOrderView((await findOrderWithNames(db, order.id))!);
    res.status(created ? 201 : 200).json(view);
  });

  router.get('/orders', requireSession, async (_req, res) => {
    const rows = await db
      .select(orderColumns)
      .from(orders)
      .innerJoin(ticketCategories, eq(ticketCategories.id, orders.categoryId))
      .innerJoin(events, eq(events.id, ticketCategories.eventId))
      .where(eq(orders.buyerId, currentUser(res).id))
      .orderBy(desc(orders.createdAt));
    res.json(rows.map(toOrderView));
  });

  router.get('/orders/:id', requireSession, async (req, res) => {
    res.json(toOrderView(await ownOrder(uuidParam(req, 'id'), currentUser(res).id)));
  });

  /**
   * The buyer is back from the payment page: ask the provider instead of trusting the redirect.
   * Expired and failed orders are asked too, so a late payment reaches review without a webhook.
   */
  router.post('/orders/:id/refresh', requireSession, async (req, res) => {
    const { order } = await ownOrder(uuidParam(req, 'id'), currentUser(res).id);
    if (order.status !== 'paid' && order.status !== 'payment_review') {
      await reconcileOrder(deps, order.id);
    }
    res.json(toOrderView((await findOrderWithNames(db, order.id))!));
  });

  router.post('/orders/:id/continue-payment', requireSession, async (req, res) => {
    const { order } = await ownOrder(uuidParam(req, 'id'), currentUser(res).id);
    if (order.status !== 'pending' || order.holdReleasedAt) {
      conflict('not_pending', 'This order is no longer waiting for payment.');
    }
    if (order.paymentDeadline <= deps.clock.now()) {
      conflict('payment_window_closed', 'The 10-minute payment window for this order has closed.');
    }
    const updated = await ensurePayment(deps, order);
    res.json({ redirectUrl: updated.paymentRedirectUrl });
  });

  return router;
}
