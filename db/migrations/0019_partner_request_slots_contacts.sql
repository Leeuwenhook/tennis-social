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
UPDATE reservation_requests SET expires_on = preferred_date WHERE expires_on IS NULL;
