import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  venueId: text('venue_id').notNull(),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  pricePence: integer('price_pence').notNull(),
  capacity: integer('capacity').notNull(),
  bookedSpots: integer('booked_spots').notNull().default(0),
  status: text('status', { enum: ['published', 'draft'] }).notNull(),
  description: text('description').notNull(),
  descriptionZh: text('description_zh').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  participantsJson: text('participants_json').notNull(),
  participantCount: integer('participant_count').notNull(),
  racketCount: integer('racket_count').notNull(),
  sessionPricePence: integer('session_price_pence').notNull(),
  racketPricePence: integer('racket_price_pence').notNull(),
  totalPence: integer('total_pence').notNull(),
  status: text('status').notNull(),
  stripeCheckoutSessionId: text('stripe_checkout_session_id').unique(),
  stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
  checkoutUrl: text('checkout_url'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const webhookEvents = sqliteTable('webhook_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  processedAt: text('processed_at').notNull(),
});
