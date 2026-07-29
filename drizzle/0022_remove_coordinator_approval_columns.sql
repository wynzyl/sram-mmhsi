-- Migration: Remove unused coordinator approval columns from grade_sheets
-- The coordinator approval step is not part of the simplified workflow:
-- draft → submitted → principal_approved → published → locked

-- Drop coordinator approval columns (if they exist)
ALTER TABLE grade_sheets DROP COLUMN IF EXISTS coordinator_approved_at;
ALTER TABLE grade_sheets DROP COLUMN IF EXISTS coordinator_approved_by;
