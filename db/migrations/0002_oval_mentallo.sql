ALTER TABLE "bookings" ADD COLUMN "confirmation_email_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "confirmation_email_sent_at" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "confirmation_email_message_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "confirmation_email_claimed_at" text;