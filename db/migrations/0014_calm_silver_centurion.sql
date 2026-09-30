ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "seeking_levels_json" text NOT NULL DEFAULT '[]';
