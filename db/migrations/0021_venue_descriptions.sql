ALTER TABLE "venues" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "description_zh" text;--> statement-breakpoint
-- Preserve legacy sessions.description / description_zh for safe rollback.
-- TODO: drop those columns only after the rollback window in a later migration.
-- Backfill each language independently from the latest dated session with nonblank
-- handwritten copy. Anchored legacy generator signatures also exclude stale auto
-- copy after date/time/capacity/venue edits (including capacity=0 without players).
-- Internal venues.notes is deliberately never exposed as public copy.
UPDATE venues AS v
SET description = (
  SELECT s.description FROM sessions AS s
  WHERE s.venue_id = v.id AND NULLIF(btrim(s.description), '') IS NOT NULL
    AND btrim(s.description) !~ '^A friendly (singles|doubles|singles and doubles) tennis session at .+ on ([A-Za-z]+, )?[0-9]{4}-[0-9]{2}-[0-9]{2}, from [0-9]{2}:[0-9]{2} to [0-9]{2}:[0-9]{2}[.] Open to all levels( with up to [0-9]+ players)?[.]$'
  ORDER BY s.date DESC, s.start_time DESC, s.created_at DESC, s.id DESC LIMIT 1
)
WHERE v.description IS NULL;
--> statement-breakpoint
UPDATE venues AS v
SET description_zh = (
  SELECT s.description_zh FROM sessions AS s
  WHERE s.venue_id = v.id AND NULLIF(btrim(s.description_zh), '') IS NOT NULL
    AND btrim(s.description_zh) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(（[^）]+）)?[0-9]{2}:[0-9]{2}–[0-9]{2}:[0-9]{2}，欢迎来到.+参加(单打|双打|单打和双打)网球活动，适合各个水平的球友(，最多可容纳[0-9]+人)?。$'
  ORDER BY s.date DESC, s.start_time DESC, s.created_at DESC, s.id DESC LIMIT 1
)
WHERE v.description_zh IS NULL;
