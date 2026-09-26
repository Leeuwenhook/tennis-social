ALTER TABLE "bookings" ADD COLUMN "reminder_email_status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reminder_email_sent_at" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reminder_email_message_id" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reminder_email_claimed_at" text;
--> statement-breakpoint
CREATE INDEX "idx_bookings_reminder_status" ON "bookings" USING btree ("status","reminder_email_status");
