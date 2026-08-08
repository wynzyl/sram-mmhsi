-- Migration: Align grade_sheets_pending_review_idx with its schema declaration
--
-- 0024 created this index as (status, submitted_at). src/lib/db/schema.ts
-- declares it as (school_year_id, status, submitted_at). 0024 is already
-- applied, and its CREATE INDEX IF NOT EXISTS is a no-op once an index of that
-- name exists — so editing 0024 would change the file without changing any
-- deployed database. The column list can only be corrected by dropping and
-- recreating the index here.
--
-- Why the schema's column order is the correct one: the partial predicate pins
-- status to a single value, so a leading status column carries no selectivity.
-- Leading school_year_id lets the principal review queue narrow to one school
-- year and still read submitted_at in index order.
--
-- grade_sheets holds one row per section per grading period, so the brief write
-- lock taken by a non-concurrent rebuild is negligible here.

DROP INDEX IF EXISTS grade_sheets_pending_review_idx;

CREATE INDEX IF NOT EXISTS grade_sheets_pending_review_idx
ON grade_sheets (school_year_id, status, submitted_at)
WHERE status = 'submitted';
