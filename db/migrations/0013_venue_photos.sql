ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "photos_json" text NOT NULL DEFAULT '[]';

UPDATE "venues"
SET "photos_json" = json_build_array("photo")::text
WHERE "photos_json" = '[]' OR "photos_json" IS NULL;
