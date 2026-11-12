import { and, eq, isNull, lte } from 'drizzle-orm';
import type { AppDeps, PaymentStatus } from '../deps.ts';
import { orders } from '../orders/schema.ts';
import { confirmPayment } from '../payments/confirm.ts';
import { releaseHold } from './release.ts';

/**
 * Asks the payment provider about one order and acts on the answer: paid confirms it,
 * expired/failed releases the place once, and pending or unknown (including an unreachable
 * provider) keeps the hold — a place is never resold while the buyer might have paid.
 */
export async function reconcileOrder(deps: AppDeps, orderId: string): Promise<PaymentStatus> {
  const status = await deps.payments.getStatus(orderId).catch((err: unknown) => {
    console.error(`payment status for ${orderId} unavailable:`, (err as Error).message);
    return 'unknown' as const;
  });
  if (status === 'paid') await confirmPayment(deps, orderId);
  if (status === 'expired' || status === 'failed') await releaseHold(deps, orderId, status);
  return status;
}

/** Every pending order past its payment deadline. Run by the interval, the CLI, and tests. */
export async function reconcileExpired(deps: AppDeps) {
  const due = await deps.db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'pending'),
        isNull(orders.holdReleasedAt),
        lte(orders.paymentDeadline, deps.clock.now()),
      ),
    );
  const summary: Record<PaymentStatus, number> = {
    paid: 0,
    pending: 0,
    expired: 0,
    failed: 0,
    unknown: 0,
  };
  for (const { id } of due) summary[await reconcileOrder(deps, id)] += 1;
  return { checked: due.length, ...summary };
}

export function startReconciler(deps: AppDeps, intervalMs = 30_000): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const result = await reconcileExpired(deps);
      if (result.checked > 0) console.log('reconciled', result);
    } catch (err) {
      console.error('reconciliation failed:', err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
