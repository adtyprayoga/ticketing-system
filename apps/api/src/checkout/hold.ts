import { and, eq, sql } from 'drizzle-orm';
import { events, ticketCategories } from '../catalog/schema.ts';
import type { AppDeps } from '../deps.ts';
import { conflict, notFound } from '../http/errors.ts';
import { orders, type OrderRow } from '../orders/schema.ts';

export const PAYMENT_WINDOW_MS = 10 * 60 * 1000;

type Tx = Parameters<Parameters<AppDeps['db']['transaction']>[0]>[0];

class SameAttemptRace extends Error {}

async function findAttempt(tx: Tx | AppDeps['db'], buyerId: string, attemptKey: string) {
  const [row] = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.buyerId, buyerId), eq(orders.attemptKey, attemptKey)));
  return row;
}

/**
 * Hold one place for a new pending order, or return the order this
 * checkout attempt already created. The hold is one guarded UPDATE, so concurrent buyers can
 * never take more places than the category has.
 */
export async function holdPlace(
  { db, clock }: Pick<AppDeps, 'db' | 'clock'>,
  input: { buyerId: string; categoryId: string; participantName: string; attemptKey: string },
): Promise<{ order: OrderRow; created: boolean }> {
  try {
    return await db.transaction(async (tx) => {
      const existing = await findAttempt(tx, input.buyerId, input.attemptKey);
      if (existing) return { order: existing, created: false };

      const [held] = await tx
        .update(ticketCategories)
        .set({ held: sql`${ticketCategories.held} + 1` })
        .where(
          and(
            eq(ticketCategories.id, input.categoryId),
            sql`${ticketCategories.held} < ${ticketCategories.capacity}`,
            eq(ticketCategories.salesOpen, true),
            sql`exists (select 1 from ${events} where ${events.id} = ${ticketCategories.eventId} and ${events.published})`,
          ),
        )
        .returning({ price: ticketCategories.price });

      if (!held) {
        // A parallel request for this same attempt may have taken the last place: return its order.
        const winner = await findAttempt(tx, input.buyerId, input.attemptKey);
        if (winner) return { order: winner, created: false };
        await explainRefusal(tx, input.categoryId);
      }

      const now = clock.now();
      const [order] = await tx
        .insert(orders)
        .values({
          buyerId: input.buyerId,
          categoryId: input.categoryId,
          participantName: input.participantName,
          attemptKey: input.attemptKey,
          amount: held!.price,
          paymentDeadline: new Date(now.getTime() + PAYMENT_WINDOW_MS),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: [orders.buyerId, orders.attemptKey] })
        .returning();
      // Lost a same-attempt race after holding: roll the hold back and return the winner's order.
      if (!order) throw new SameAttemptRace();
      return { order, created: true };
    });
  } catch (err) {
    if (!(err instanceof SameAttemptRace)) throw err;
    const winner = await findAttempt(db, input.buyerId, input.attemptKey);
    return { order: winner!, created: false };
  }
}

async function explainRefusal(tx: Tx, categoryId: string): Promise<never> {
  const [row] = await tx
    .select({
      capacity: ticketCategories.capacity,
      held: ticketCategories.held,
      salesOpen: ticketCategories.salesOpen,
      published: events.published,
    })
    .from(ticketCategories)
    .innerJoin(events, eq(events.id, ticketCategories.eventId))
    .where(eq(ticketCategories.id, categoryId));
  if (!row) notFound();
  if (!row.published || !row.salesOpen)
    conflict('not_on_sale', 'This ticket category is not on sale.');
  conflict('places_held', 'All remaining places are held. Check back in a few minutes.');
}
