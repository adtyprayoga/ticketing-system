import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  venue: text('venue').notNull(),
  published: boolean('published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ticketCategories = pgTable(
  'ticket_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Whole rupiah. */
    price: integer('price').notNull(),
    capacity: integer('capacity').notNull(),
    /** Places held by pending orders plus places sold. Only the inventory helpers change it. */
    held: integer('held').notNull().default(0),
    salesOpen: boolean('sales_open').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('ticket_categories_price_positive', sql`${t.price} > 0`),
    check('ticket_categories_held_range', sql`${t.held} >= 0 and ${t.held} <= ${t.capacity}`),
  ],
);
