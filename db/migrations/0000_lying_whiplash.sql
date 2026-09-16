CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"participants_json" text NOT NULL,
	"participant_count" integer NOT NULL,
	"racket_count" integer NOT NULL,
	"session_price_pence" integer NOT NULL,
	"racket_price_pence" integer NOT NULL,
	"total_pence" integer NOT NULL,
	"status" text NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"checkout_url" text,
	"expires_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"price_pence" integer NOT NULL,
	"capacity" integer NOT NULL,
	"booked_spots" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"description" text NOT NULL,
	"description_zh" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bookings_session_status" ON "bookings" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "idx_bookings_status_expiry" ON "bookings" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_stripe_checkout_session_id_unique" ON "bookings" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_stripe_payment_intent_id_unique" ON "bookings" USING btree ("stripe_payment_intent_id");