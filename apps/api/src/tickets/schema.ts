import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from '../auth/schema.ts';
import { orders } from '../orders/schema.ts';

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Unique: however many paid notifications arrive, an order gets one ticket. */
  orderId: uuid('order_id')
    .notNull()
    .unique()
    .references(() => orders.id),
  /** Opaque, random; the QR code encodes only this. Stored normalized (uppercase, no dashes). */
  lookupCode: text('lookup_code').notNull().unique(),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  checkedInBy: text('checked_in_by').references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});
