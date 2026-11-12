import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { user } from '../auth/schema.ts';
import { events } from '../catalog/schema.ts';

/** Which staff members may look up and check in tickets for which event. Seed/CLI only. */
export const staffAssignments = pgTable(
  'staff_assignments',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);
