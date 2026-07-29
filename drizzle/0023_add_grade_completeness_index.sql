-- Migration: Add partial index for grade sheet completeness queries
-- This index speeds up the COUNT(*) query used in validateGradeSheetCompleteness()
-- to check how many entries have non-null grades

CREATE INDEX CONCURRENTLY IF NOT EXISTS grade_sheet_entries_filled_idx
ON grade_sheet_entries (grade_sheet_id)
WHERE grade IS NOT NULL;
