ALTER TABLE "reservation_requests" ADD COLUMN "request_type" text NOT NULL DEFAULT 'known_venue';
ALTER TABLE "reservation_requests" ADD COLUMN "postcode" text NOT NULL DEFAULT '';
