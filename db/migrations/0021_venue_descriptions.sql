ALTER TABLE "venues" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "description_zh" text;--> statement-breakpoint
-- Preserve legacy sessions.description / description_zh for safe rollback.
-- TODO: drop those columns only after the rollback window in a later migration.
-- Backfill each language independently from the latest dated session with nonblank
-- handwritten copy. Anchored legacy generator signatures also exclude stale auto
-- copy after date/time/capacity/venue edits (including capacity=0 without players).
-- Internal venues.notes is deliberately never exposed as public copy.
-- Demo seed copy (lib/demo-data.ts, lib/server/seed.ts history) is session-specific
-- ("One place left.", "A full Saturday morning group") and is never venue copy.
UPDATE venues AS v
SET description = (
  SELECT s.description FROM sessions AS s
  WHERE s.venue_id = v.id AND NULLIF(btrim(s.description), '') IS NOT NULL
    AND btrim(s.description) !~ '^A friendly (singles|doubles|singles and doubles) tennis session at .+ on ([A-Za-z]+, )?[0-9]{4}-[0-9]{2}-[0-9]{2}, from [0-9]{2}:[0-9]{2} to [0-9]{2}:[0-9]{2}[.] Open to all levels( with up to [0-9]+ players)?[.]$'
    AND btrim(s.description) NOT IN (
      'A relaxed midweek hit with rotating doubles and friendly match play.',
      'Friday evening tennis on a bright, quiet court. One place left.',
      'A full Saturday morning group with structured doubles rotations.',
      'Longer Sunday tennis with plenty of time to warm up and play through.',
      'Longer Sunday session with plenty of time to warm up and play through.',
      'A riverside evening session with a mix of drills and open games.',
      'Small-group evening tennis for focused rallies and competitive points.',
      'A fresh Saturday morning start for singles, doubles and new faces.',
      'A sociable Saturday session with easy drills and rotating doubles.'
    )
  ORDER BY s.date DESC, s.start_time DESC, s.created_at DESC, s.id DESC LIMIT 1
)
WHERE v.description IS NULL;
--> statement-breakpoint
UPDATE venues AS v
SET description_zh = (
  SELECT s.description_zh FROM sessions AS s
  WHERE s.venue_id = v.id AND NULLIF(btrim(s.description_zh), '') IS NOT NULL
    AND btrim(s.description_zh) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(（[^）]+）)?[0-9]{2}:[0-9]{2}–[0-9]{2}:[0-9]{2}，欢迎来到.+参加(单打|双打|单打和双打)网球活动，适合各个水平的球友(，最多可容纳[0-9]+人)?。$'
    AND btrim(s.description_zh) NOT IN (
      '轻松的工作日晚间约球，轮换双打并穿插友谊赛。',
      '周五晚在安静明亮的球场打球，目前只剩 1 个名额。',
      '周六上午的固定小组活动，安排双打轮换。',
      '周日较长时段，留出充分热身和连续对打时间。',
      '河边晚间活动，结合简单练习和自由对打。',
      '小组晚间约球，适合专注对拉和更有竞争感的回合。',
      '周六上午轻松开场，欢迎单打、双打和第一次来的朋友。',
      '适合社交的周六活动，包含简单练习和双打轮换。'
    )
  ORDER BY s.date DESC, s.start_time DESC, s.created_at DESC, s.id DESC LIMIT 1
)
WHERE v.description_zh IS NULL;
