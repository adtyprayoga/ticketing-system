import { and, eq } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import { createAuth } from '../auth/auth.ts';
import { user, type Role } from '../auth/schema.ts';
import { events, ticketCategories } from '../catalog/schema.ts';
import type { AppDeps } from '../deps.ts';
import { assignStaff } from '../staff/assign.ts';

export const SEED_PASSWORD = 'workshop-password';

const accounts: { email: string; name: string; role: Role }[] = [
  { email: 'buyer@example.com', name: 'Bima Buyer', role: 'buyer' },
  { email: 'admin@example.com', name: 'Ayu Admin', role: 'admin' },
  { email: 'staff1@example.com', name: 'Sari Staff', role: 'staff' },
  { email: 'staff2@example.com', name: 'Dewa Staff', role: 'staff' },
  { email: 'staff3@example.com', name: 'Rina Staff', role: 'staff' },
];

/** Demo data for local development and the e2e journey. Safe to run repeatedly. */
export async function seed(deps: Pick<AppDeps, 'db' | 'config'>): Promise<void> {
  const auth = createAuth(deps);
  for (const a of accounts) {
    const [existing] = await deps.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, a.email));
    if (!existing) {
      await auth.api.signUpEmail({
        body: { email: a.email, password: SEED_PASSWORD, name: a.name },
      });
    }
    await deps.db.update(user).set({ role: a.role }).where(eq(user.email, a.email));
  }
  await seedDemoRace(deps);
  for (const email of ['staff1@example.com', 'staff2@example.com']) {
    await assignStaff(deps.db, { eventSlug: DEMO_EVENT_SLUG, email });
  }
}

export const DEMO_EVENT_SLUG = 'jakarta-night-run-2026';

/** A published race with a small 12K category, so every rule can be shown right away. */
async function seedDemoRace({ db }: Pick<AppDeps, 'db'>): Promise<void> {
  await db
    .insert(events)
    .values({
      slug: DEMO_EVENT_SLUG,
      name: 'Jakarta Night Run 2026',
      startsAt: new Date('2026-12-06T19:00:00+07:00'),
      venue: 'Gelora Bung Karno',
      published: true,
    })
    .onConflictDoNothing({ target: events.slug });
  const [event] = await db.select().from(events).where(eq(events.slug, DEMO_EVENT_SLUG));
  const [existing] = await db
    .select({ id: ticketCategories.id })
    .from(ticketCategories)
    .where(and(eq(ticketCategories.eventId, event!.id), eq(ticketCategories.name, '12K')));
  if (!existing) {
    await db
      .insert(ticketCategories)
      .values({ eventId: event!.id, name: '12K', price: 150_000, capacity: 3 });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { parseConfig } = await import('../config.ts');
  const { createDb } = await import('./client.ts');
  const config = parseConfig(process.env);
  const { db, pool } = createDb(config.databaseUrl);
  await seed({ db, config });
  await pool.end();
  console.log(`seeded; every account's password is "${SEED_PASSWORD}"`);
}
