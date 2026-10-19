CREATE TABLE "review_media" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text,
	"booking_id" text NOT NULL,
	"kind" text NOT NULL,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_seconds" integer,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"session_id" text NOT NULL,
	"venue_id" text NOT NULL,
	"display_name" text NOT NULL,
	"rating" integer,
	"body" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"consent_public" boolean NOT NULL,
	"consent_media" boolean DEFAULT false NOT NULL,
	"consent_at" text NOT NULL,
	"moderation_note" text DEFAULT '' NOT NULL,
	"moderated_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_review_id_session_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."session_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_media_blob_pathname_unique" ON "review_media" USING btree ("blob_pathname");--> statement-breakpoint
CREATE INDEX "idx_review_media_review" ON "review_media" USING btree ("review_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_review_media_booking_status" ON "review_media" USING btree ("booking_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "session_reviews_booking_unique" ON "session_reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_session_reviews_venue_status_created" ON "session_reviews" USING btree ("venue_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_session_reviews_status_created" ON "session_reviews" USING btree ("status","created_at");