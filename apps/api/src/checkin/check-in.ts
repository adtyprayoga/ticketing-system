import { and, eq, isNull } from 'drizzle-orm';
import { user } from '../auth/schema.ts';
import type { AppDeps } from '../deps.ts';
import { tickets } from '../tickets/schema.ts';

export type CheckInResult =
  | { result: 'checked_in'; checkedInAt: Date; staffId: string }
  | { result: 'already_checked_in'; checkedInAt: Date; staffId: string };

/**
 * Admit the participant once. The guarded UPDATE
 * only matches an unused ticket, so of two staff confirming at the same moment exactly one
 * records the check-in and the other is told who already did.
 */
export async function checkIn(
  { db, clock }: Pick<AppDeps, 'db' | 'clock'>,
  ticketId: string,
  staffId: string,
): Promise<CheckInResult> {
  const [admitted] = await db
    .update(tickets)
    .set({ checkedInAt: clock.now(), checkedInBy: staffId })
    .where(and(eq(tickets.id, ticketId), isNull(tickets.checkedInAt)))
    .returning({ checkedInAt: tickets.checkedInAt, staffId: tickets.checkedInBy });
  if (admitted)
    return { result: 'checked_in', checkedInAt: admitted.checkedInAt!, staffId: admitted.staffId! };
  const [existing] = await db
    .select({ checkedInAt: tickets.checkedInAt, staffId: tickets.checkedInBy })
    .from(tickets)
    .where(eq(tickets.id, ticketId));
  return {
    result: 'already_checked_in',
    checkedInAt: existing!.checkedInAt!,
    staffId: existing!.staffId!,
  };
}

export async function staffName(db: AppDeps['db'], staffId: string | null) {
  if (!staffId) return null;
  const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, staffId));
  return row ? { name: row.name } : null;
}
