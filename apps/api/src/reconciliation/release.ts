import { and, eq, isNull, sql } from 'drizzle-orm';
import { ticketCategories } from '../catalog/schema.ts';
import type { AppDeps } from '../deps.ts';
import { orders } from '../orders/schema.ts';

/**
 * Give a pending order's place back, exactly once. The guarded
 * UPDATE only matches an order whose hold is still active, so when reconciliation and a
 * provider notification race, only one of them returns the place.
 */
export async function releaseHold(
  { db, clock }: Pick<AppDeps, 'db' | 'clock'>,
  orderId: string,
  outcome: 'expired' | 'failed',
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = clock.now();
    const [released] = await tx
      .update(orders)
      .set({ status: outcome, holdReleasedAt: now, updatedAt: now })
      .where(
        and(eq(orders.id, orderId), eq(orders.status, 'pending'), isNull(orders.holdReleasedAt)),
      )
      .returning({ categoryId: orders.categoryId });
    if (!released) return false;
    await tx
      .update(ticketCategories)
      .set({ held: sql`${ticketCategories.held} - 1` })
      .where(eq(ticketCategories.id, released.categoryId));
    return true;
  });
}
