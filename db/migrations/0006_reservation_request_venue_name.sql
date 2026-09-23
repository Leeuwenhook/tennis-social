ALTER TABLE "reservation_requests" ADD COLUMN "venue_name" text;
--> statement-breakpoint
UPDATE "reservation_requests" AS requests
SET "venue_name" = venues.name
FROM "venues" AS venues
WHERE requests.venue_id = venues.id;
--> statement-breakpoint
ALTER TABLE "reservation_requests" ALTER COLUMN "venue_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "reservation_requests" ALTER COLUMN "venue_name" SET NOT NULL;
