ALTER TABLE "bookings" ADD COLUMN "loyalty_discount_percent" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "loyalty_discount_pence" integer DEFAULT 0 NOT NULL;
