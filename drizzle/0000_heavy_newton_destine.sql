CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`contact_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`participants_json` text NOT NULL,
	`participant_count` integer NOT NULL,
	`racket_count` integer NOT NULL,
	`session_price_pence` integer NOT NULL,
	`racket_price_pence` integer NOT NULL,
	`total_pence` integer NOT NULL,
	`status` text NOT NULL,
	`stripe_checkout_session_id` text,
	`stripe_payment_intent_id` text,
	`checkout_url` text,
	`expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_stripe_checkout_session_id_unique` ON `bookings` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_stripe_payment_intent_id_unique` ON `bookings` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`price_pence` integer NOT NULL,
	`capacity` integer NOT NULL,
	`booked_spots` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`description` text NOT NULL,
	`description_zh` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`processed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bookings_session_status` ON `bookings` (`session_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_bookings_status_expiry` ON `bookings` (`status`, `expires_at`);
--> statement-breakpoint
CREATE TRIGGER `bookings_validate_reservation`
BEFORE INSERT ON `bookings`
WHEN NEW.`status` = 'pending_payment'
BEGIN
  SELECT (CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM `sessions`
      WHERE `id` = NEW.`session_id`
        AND `status` = 'published'
        AND `booked_spots` + NEW.`participant_count` <= `capacity`
    ) THEN RAISE(ABORT, 'session_unavailable')
  END);
END;
--> statement-breakpoint
CREATE TRIGGER `bookings_reserve_places`
AFTER INSERT ON `bookings`
WHEN NEW.`status` = 'pending_payment'
BEGIN
  UPDATE `sessions`
  SET `booked_spots` = `booked_spots` + NEW.`participant_count`,
      `updated_at` = NEW.`updated_at`
  WHERE `id` = NEW.`session_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `bookings_release_places`
AFTER UPDATE OF `status` ON `bookings`
WHEN OLD.`status` IN ('pending_payment', 'confirmed')
  AND NEW.`status` IN ('expired', 'payment_failed', 'cancelled', 'refunded')
BEGIN
  UPDATE `sessions`
  SET `booked_spots` = MAX(0, `booked_spots` - OLD.`participant_count`),
      `updated_at` = NEW.`updated_at`
  WHERE `id` = OLD.`session_id`;
END;
--> statement-breakpoint
PRAGMA optimize;
