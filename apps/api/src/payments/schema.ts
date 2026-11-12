import { bigint, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { orders } from '../orders/schema.ts';

/** Every provider notification as received, for diagnosing duplicates and late payments. */
export const paymentNotifications = pgTable('payment_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id),
  provider: text('provider').notNull(),
  status: text('status').notNull(),
  raw: jsonb('raw').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
});

/** What the local simulator's "provider" currently says about each order. */
export const simulatorPayments = pgTable('simulator_payments', {
  orderId: uuid('order_id')
    .primaryKey()
    .references(() => orders.id),
  status: text('status').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

/**
 * How far "Advance clock" has moved the simulator's clock, in one row, so the API and
 * `npm run reconcile` (a separate process) agree on the time.
 */
export const simulatorClock = pgTable('simulator_clock', {
  id: integer('id').primaryKey().default(1),
  offsetMs: bigint('offset_ms', { mode: 'number' }).notNull(),
});
