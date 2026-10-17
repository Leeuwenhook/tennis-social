DROP INDEX "idx_reservation_requests_status_date";--> statement-breakpoint
ALTER TABLE "reservation_requests" ALTER COLUMN "preferred_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ALTER COLUMN "start_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ALTER COLUMN "end_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_request_applications" ADD COLUMN "wechat" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_request_applications" ADD COLUMN "whatsapp" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_request_applications" ADD COLUMN "preferred_contact" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "preferred_slots_json" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "expires_on" text;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "wechat" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "whatsapp" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "preferred_contact" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_reservation_requests_status_expiry" ON "reservation_requests" USING btree ("status","expires_on");--> statement-breakpoint
UPDATE reservation_requests SET expires_on = preferred_date WHERE expires_on IS NULL;
