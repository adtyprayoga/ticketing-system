import { eq } from 'drizzle-orm';
import { user } from '../auth/schema.ts';
import { events } from '../catalog/schema.ts';
import type { Db } from '../db/client.ts';
import { staffAssignments } from './schema.ts';

/** Assigns a staff account to an event. Idempotent. Throws a readable message on bad input. */
export async function assignStaff(
  db: Db,
  { eventSlug, email }: { eventSlug: string; email: string },
) {
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.slug, eventSlug));
  if (!event) throw new Error(`No event with slug "${eventSlug}"`);
  const [staff] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.email, email.trim().toLowerCase()));
  if (!staff) throw new Error(`No account with email "${email}"`);
  if (staff.role !== 'staff') throw new Error(`${email} is a ${staff.role}, not staff`);
  await db
    .insert(staffAssignments)
    .values({ eventId: event.id, userId: staff.id })
    .onConflictDoNothing();
}
