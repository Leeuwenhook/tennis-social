CREATE TABLE "partner_request_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"tennis_level" text NOT NULL,
	"preferred_format" text NOT NULL,
	"can_attend_full_duration" boolean DEFAULT false NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "request_kind" text DEFAULT 'find_court' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "venue_booking_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "existing_player_levels_json" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "seeking_player_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "seeking_levels_json" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "preferred_format" text DEFAULT 'flexible' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "full_duration_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "budget_pence" integer;--> statement-breakpoint
ALTER TABLE "partner_request_applications" ADD CONSTRAINT "partner_request_applications_request_id_reservation_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."reservation_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_request_applications" ADD CONSTRAINT "partner_request_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_request_applications_request_email_unique" ON "partner_request_applications" USING btree ("request_id","email");--> statement-breakpoint
CREATE INDEX "idx_partner_request_applications_request_status" ON "partner_request_applications" USING btree ("request_id","status");