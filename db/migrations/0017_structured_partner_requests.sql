ALTER TABLE "reservation_requests" ADD COLUMN "request_kind" text NOT NULL DEFAULT 'find_court';--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "venue_booking_status" text NOT NULL DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "existing_player_levels_json" text NOT NULL DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "seeking_player_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "seeking_levels_json" text NOT NULL DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "preferred_format" text NOT NULL DEFAULT 'flexible';--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "full_duration_required" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "budget_pence" integer;--> statement-breakpoint
CREATE TABLE "partner_request_applications" (
  "id" text PRIMARY KEY NOT NULL,
  "request_id" text NOT NULL REFERENCES "reservation_requests"("id") ON DELETE cascade,
  "user_id" text REFERENCES "users"("id") ON DELETE set null,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text NOT NULL DEFAULT '',
  "tennis_level" text NOT NULL,
  "preferred_format" text NOT NULL,
  "can_attend_full_duration" boolean NOT NULL DEFAULT false,
  "message" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "partner_request_applications_request_email_unique" ON "partner_request_applications" ("request_id", "email");--> statement-breakpoint
CREATE INDEX "idx_partner_request_applications_request_status" ON "partner_request_applications" ("request_id", "status");
