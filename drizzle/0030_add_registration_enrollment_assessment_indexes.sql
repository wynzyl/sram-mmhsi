-- Migration: Add performance indexes for registration, enrollment, and assessment modules
-- Description: Optimize query performance for common access patterns
-- Date: 2026-08-13

-- ─── Registration Module ────────────────────────────────────────────────────────

-- Index for student-based registration lookups
CREATE INDEX IF NOT EXISTS registrations_student_idx
ON registrations (student_id);

-- ─── Enrollment Cancellation Module ─────────────────────────────────────────────

-- Index for looking up requests by the user who requested them
CREATE INDEX IF NOT EXISTS ecr_requested_by_idx
ON enrollment_cancellation_requests (requested_by);

-- Index for looking up requests by the reviewer
CREATE INDEX IF NOT EXISTS ecr_reviewed_by_idx
ON enrollment_cancellation_requests (reviewed_by);

-- ─── Payments Module ────────────────────────────────────────────────────────────

-- Composite index for assessment payment queries with status filtering
-- Covers: Payment reconciliation, ledger calculations
CREATE INDEX IF NOT EXISTS payments_assessment_created_idx
ON payments (assessment_id, created_at, status);

-- ─── Guardian Links Module ──────────────────────────────────────────────────────

-- Index for primary guardian lookup per student
-- Covers: Student detail pages, enrollment forms
CREATE INDEX IF NOT EXISTS sgl_student_primary_idx
ON student_guardian_links (student_id, is_primary, created_at)
WHERE deleted_at IS NULL;
