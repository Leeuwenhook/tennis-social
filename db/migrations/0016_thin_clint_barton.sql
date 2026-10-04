ALTER TABLE "venues" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "address_zh" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "postcode" text DEFAULT '' NOT NULL;