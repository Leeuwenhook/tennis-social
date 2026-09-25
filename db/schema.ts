import { index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const venues = pgTable('venues', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameZh: text('name_zh').notNull(),
  area: text('area').notNull(),
  areaZh: text('area_zh').notNull(),
  photo: text('photo').notNull(),
  peakPricePence: integer('peak_price_pence').notNull(),
  offPeakPricePence: integer('off_peak_price_pence').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

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

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  postcode: text('postcode').notNull(),
  tennisLevel: text('tennis_level').notNull(),
  preferredTime: text('preferred_time').notNull(),
  preferredFormat: text('preferred_format').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('users_email_unique').on(table.email),
]);

export const userSessions = pgTable('user_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_user_sessions_user_id').on(table.userId),
  index('idx_user_sessions_expires_at').on(table.expiresAt),
]);

export const coupons = pgTable('coupons', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  discountPercent: integer('discount_percent').notNull().default(50),
  milestoneCount: integer('milestone_count').notNull(),
  issuedAt: text('issued_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  status: text('status', { enum: ['available', 'reserved', 'redeemed', 'expired'] }).notNull().default('available'),
  reservedBookingId: text('reserved_booking_id'),
  redeemedBookingId: text('redeemed_booking_id'),
  redeemedAt: text('redeemed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('coupons_code_unique').on(table.code),
  uniqueIndex('coupons_user_milestone_unique').on(table.userId, table.milestoneCount),
  index('idx_coupons_user_status_expiry').on(table.userId, table.status, table.expiresAt),
]);

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  participantsJson: text('participants_json').notNull(),
  format: text('format').notNull().default('singles'),
  participantCount: integer('participant_count').notNull(),
  racketCount: integer('racket_count').notNull(),
  sessionPricePence: integer('session_price_pence').notNull(),
  racketPricePence: integer('racket_price_pence').notNull(),
  couponId: text('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
  couponDiscountPence: integer('coupon_discount_pence').notNull().default(0),
  totalPence: integer('total_pence').notNull(),
  status: text('status').notNull(),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  checkoutUrl: text('checkout_url'),
  expiresAt: text('expires_at'),
  confirmationEmailStatus: text('confirmation_email_status', { enum: ['pending', 'sending', 'sent'] }).notNull().default('pending'),
  confirmationEmailSentAt: text('confirmation_email_sent_at'),
  confirmationEmailMessageId: text('confirmation_email_message_id'),
  confirmationEmailClaimedAt: text('confirmation_email_claimed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_bookings_session_status').on(table.sessionId, table.status),
  index('idx_bookings_status_expiry').on(table.status, table.expiresAt),
  index('idx_bookings_user_status').on(table.userId, table.status),
  uniqueIndex('bookings_stripe_checkout_session_id_unique').on(table.stripeCheckoutSessionId),
  uniqueIndex('bookings_stripe_payment_intent_id_unique').on(table.stripePaymentIntentId),
]);

export const webhookEvents = pgTable('webhook_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  processedAt: text('processed_at').notNull(),
});

export const reservationRequests = pgTable('reservation_requests', {
  id: text('id').primaryKey(),
  venueId: text('venue_id').references(() => venues.id),
  venueName: text('venue_name').notNull(),
  preferredDate: text('preferred_date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  message: text('message').notNull().default(''),
  status: text('status', { enum: ['pending', 'reviewing', 'completed'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_reservation_requests_status_date').on(table.status, table.preferredDate),
]);
