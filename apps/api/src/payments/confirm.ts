import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { AppDeps, PaymentNotification } from '../deps.ts';
import { orders } from '../orders/schema.ts';
import { generateLookupCode } from '../tickets/lookup-code.ts';
import { tickets } from '../tickets/schema.ts';
import { releaseHold } from '../reconciliation/release.ts';
import { paymentNotifications } from './schema.ts';

export type ConfirmOutcome = 'paid' | 'already_paid' | 'payment_review' | 'ignored';

/**
 * Trainer helper: a verified payment for `orderId`. Locks the order row so parallel duplicate
 * notifications line up; the first one issues the ticket and the rest find it already paid.
 */
export async function confirmPayment(
  { db, clock }: Pick<AppDeps, 'db' | 'clock'>,
  orderId: string,
): Promise<ConfirmOutcome> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!order) return 'ignored';
    if (order.status === 'paid') return 'already_paid';
    const now = clock.now();
    if (order.holdReleasedAt) {
      // Paid after the place went back on sale: flag it for staff, never take
      // the place back from whoever holds it now.
      if (order.status !== 'payment_review') {
        await tx
          .update(orders)
          .set({ status: 'payment_review', updatedAt: now })
          .where(eq(orders.id, orderId));
      }
      return 'payment_review';
    }
    if (order.status !== 'pending') return 'ignored';
    await tx.update(orders).set({ status: 'paid', updatedAt: now }).where(eq(orders.id, orderId));
    await tx
      .insert(tickets)
      .values({ orderId, lookupCode: generateLookupCode(), createdAt: now })
      .onConflictDoNothing({ target: tickets.orderId });
    return 'paid';
  });
}

/** The one place a provider notification is acted on, whichever provider sent it. */
export async function handleNotification(
  deps: Pick<AppDeps, 'db' | 'clock' | 'config'>,
  notification: PaymentNotification,
): Promise<void> {
  // Our order ids are UUIDs; anything else (a provider's test notification) is not our order.
  if (!z.uuid().safeParse(notification.orderId).success) return;
  const [order] = await deps.db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.id, notification.orderId));
  if (!order) return;
  await deps.db.insert(paymentNotifications).values({
    orderId: notification.orderId,
    provider: deps.config.paymentProvider,
    status: notification.status,
    raw: notification.raw ?? {},
    receivedAt: deps.clock.now(),
  });
  if (notification.status === 'paid') await confirmPayment(deps, notification.orderId);
  if (notification.status === 'expired' || notification.status === 'failed') {
    await releaseHold(deps, notification.orderId, notification.status);
  }
}
