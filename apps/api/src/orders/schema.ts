import { integer, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { user } from '../auth/schema.ts';
import { ticketCategories } from '../catalog/schema.ts';

export const orderStatus = pgEnum('order_status', [
  'pending',
  'paid',
  'expired',
  'failed',
  'payment_review',
]);
export type OrderStatus = (typeof orderStatus.enumValues)[number];

export const orders = pgTable(
  'orders',
  {
    /** Also the payment provider's order id (Midtrans order_id). */
    id: uuid('id').primaryKey().defaultRandom(),
    buyerId: text('buyer_id')
      .notNull()
      .references(() => user.id),
    // RESTRICT: the database backstop for "delete only while there are no orders".
    categoryId: uuid('category_id')
      .notNull()
      .references(() => ticketCategories.id, { onDelete: 'restrict' }),
    participantName: text('participant_name').notNull(),
    /** Whole rupiah, fixed at checkout: later price edits don't touch it. */
    amount: integer('amount').notNull(),
    /** Created by the buy form when it opens; a retry of the same attempt reuses it. */
    attemptKey: uuid('attempt_key').notNull(),
    status: orderStatus('status').notNull().default('pending'),
    paymentDeadline: timestamp('payment_deadline', { withTimezone: true }).notNull(),
    holdReleasedAt: timestamp('hold_released_at', { withTimezone: true }),
    paymentToken: text('payment_token'),
    paymentRedirectUrl: text('payment_redirect_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [unique('orders_buyer_attempt_unique').on(t.buyerId, t.attemptKey)],
);

export type OrderRow = typeof orders.$inferSelect;
