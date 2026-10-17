ALTER TABLE "bookings" ADD COLUMN "admin_notification_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "admin_notification_claimed_at" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "admin_notification_sent_at" text;--> statement-breakpoint
UPDATE bookings SET admin_notification_status = 'skipped';
