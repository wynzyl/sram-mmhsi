-- Migration: Add performance indexes for academics module
-- Description: Optimize grade entry and subject offerings queries
-- Date: 2026-08-12

-- ─── Subject Offerings Performance Indexes ───────────────────────────────────

-- Index for grade entry queries that filter by section, school year, and active status
-- Covers: getSubjectsFromOfferingsForSection, getSubjectsForSHSGradeEntry, getSubjectOfferingsForSection
CREATE INDEX IF NOT EXISTS subject_offerings_section_sy_active_idx
ON subject_offerings (section_id, school_year_id)
WHERE is_active = true AND deleted_at IS NULL;

-- ─── Student Subject Enrollments Performance Indexes ─────────────────────────

-- Index for grade validation and SSE lookup queries
-- Covers: getStudentsWithSSEForSection, grade sheet entry validation
CREATE INDEX IF NOT EXISTS sse_enrollment_active_idx
ON student_subject_enrollments (enrollment_id)
WHERE is_active = true AND deleted_at IS NULL;

-- Index for subject offering lookups in SSE queries (frequently joined)
-- Covers: JOIN conditions in getStudentsWithSSEForSection
CREATE INDEX IF NOT EXISTS sse_subject_offering_active_idx
ON student_subject_enrollments (subject_offering_id)
WHERE is_active = true AND deleted_at IS NULL;

-- ─── Grade Sheets Performance Indexes ────────────────────────────────────────

-- Index for getPeriodsCompletionStatus and similar section + school year queries
-- Covers: Grade sheet status lookups per section and school year
CREATE INDEX IF NOT EXISTS grade_sheets_section_sy_idx
ON grade_sheets (section_id, school_year_id);

-- Partial index for grade sheet by period lookup (frequent query pattern)
-- Covers: getGradeSheetForPeriod
CREATE INDEX IF NOT EXISTS grade_sheets_section_sy_period_idx
ON grade_sheets (section_id, school_year_id, grading_period);
