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
UPDATE reservation_requests SET expires_on = preferred_date WHERE expires_on IS NULL;--> statement-breakpoint
UPDATE reservation_requests SET preferred_slots_json = COALESCE((
  SELECT json_agg(periods.slot ORDER BY periods.position)::text
  FROM (VALUES (1, 'morning', '00:00', '12:00'), (2, 'afternoon', '12:00', '18:00'), (3, 'evening', '18:00', '24:00')) AS periods(position, slot, starts_at, ends_at)
  WHERE reservation_requests.start_time < periods.ends_at AND reservation_requests.end_time > periods.starts_at
), '[]')
WHERE preferred_slots_json = '[]' AND start_time IS NOT NULL AND end_time IS NOT NULL;
