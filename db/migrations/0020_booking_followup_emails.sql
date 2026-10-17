CREATE TABLE "email_suppressions" (
	"email" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "followup_email_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "followup_email_sent_at" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "followup_email_message_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "followup_email_claimed_at" text;--> statement-breakpoint
CREATE INDEX "idx_bookings_followup_status" ON "bookings" USING btree ("status","followup_email_status");--> statement-breakpoint
-- Do not send follow-ups for sessions that had already ended at deployment.
UPDATE bookings SET followup_email_status = 'skipped';
--> statement-breakpoint
UPDATE bookings SET followup_email_status = 'pending'
WHERE session_id IN (
  SELECT id FROM sessions
  WHERE date > to_char(now() AT TIME ZONE 'Europe/London', 'YYYY-MM-DD')
     OR (date = to_char(now() AT TIME ZONE 'Europe/London', 'YYYY-MM-DD')
         AND end_time > to_char(now() AT TIME ZONE 'Europe/London', 'HH24:MI'))
);
