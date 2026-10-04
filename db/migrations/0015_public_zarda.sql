CREATE TABLE IF NOT EXISTS "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
INSERT INTO "app_settings" ("key", "value", "updated_at")
VALUES ('racket_rental_enabled', 'false', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
