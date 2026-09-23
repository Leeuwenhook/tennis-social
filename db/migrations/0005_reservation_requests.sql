CREATE TABLE "reservation_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"preferred_date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD CONSTRAINT "reservation_requests_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_reservation_requests_status_date" ON "reservation_requests" USING btree ("status","preferred_date");
