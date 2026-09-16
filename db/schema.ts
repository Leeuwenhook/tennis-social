import { index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  venueId: text('venue_id').notNull(),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  pricePence: integer('price_pence').notNull(),
  capacity: integer('capacity').notNull(),
  bookedSpots: integer('booked_spots').notNull().default(0),
  formatsJson: text('formats_json').notNull().default('["singles","doubles"]'),
  status: text('status', { enum: ['published', 'draft'] }).notNull(),
  description: text('description').notNull(),
  descriptionZh: text('description_zh').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  participantsJson: text('participants_json').notNull(),
  format: text('format').notNull().default('singles'),
  participantCount: integer('participant_count').notNull(),
  racketCount: integer('racket_count').notNull(),
  sessionPricePence: integer('session_price_pence').notNull(),
  racketPricePence: integer('racket_price_pence').notNull(),
  totalPence: integer('total_pence').notNull(),
  status: text('status').notNull(),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  checkoutUrl: text('checkout_url'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_bookings_session_status').on(table.sessionId, table.status),
  index('idx_bookings_status_expiry').on(table.status, table.expiresAt),
  uniqueIndex('bookings_stripe_checkout_session_id_unique').on(table.stripeCheckoutSessionId),
  uniqueIndex('bookings_stripe_payment_intent_id_unique').on(table.stripePaymentIntentId),
]);

export const webhookEvents = pgTable('webhook_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  processedAt: text('processed_at').notNull(),
});
