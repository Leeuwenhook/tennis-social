CREATE TABLE "admin_booking_cancellations" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"refund" boolean NOT NULL,
	"actor" text NOT NULL,
	"completed_at" text,
	"email_status" text DEFAULT 'pending' NOT NULL,
	"email_claim" text,
	"email_claimed_at" text
);
--> statement-breakpoint
ALTER TABLE "admin_login_attempts" ADD COLUMN "account_locked_until" text;--> statement-breakpoint
ALTER TABLE "admin_login_attempts" ADD COLUMN "ip_locked_until" text;--> statement-breakpoint
ALTER TABLE "admin_booking_cancellations" ADD CONSTRAINT "admin_booking_cancellations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;