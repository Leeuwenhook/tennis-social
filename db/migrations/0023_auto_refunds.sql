ALTER TABLE "bookings" ADD COLUMN "auto_refund_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "auto_refund_claimed_at" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "auto_refunded_at" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "auto_refund_id" text;