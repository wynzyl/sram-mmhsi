-- Add lastActivityAt column to sessions table for idle timeout tracking
-- Default to NOW() so existing sessions are treated as just-active
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'sessions' AND column_name = 'last_activity_at') THEN
    ALTER TABLE "sessions" ADD COLUMN "last_activity_at" timestamp DEFAULT NOW() NOT NULL;
  END IF;
END $$;
