ALTER TABLE "bookings" ADD COLUMN "format" text DEFAULT 'singles' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "formats_json" text DEFAULT '["singles","doubles"]' NOT NULL;