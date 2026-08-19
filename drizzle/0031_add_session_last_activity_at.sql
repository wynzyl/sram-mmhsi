-- Add lastActivityAt column to sessions table for idle timeout tracking
-- Default to NOW() so existing sessions are treated as just-active
ALTER TABLE "sessions" ADD COLUMN "last_activity_at" timestamp DEFAULT NOW() NOT NULL;
