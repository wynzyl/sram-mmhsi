-- Migration: Add soft-delete columns to payments table
-- Description: Adds deletedAt/deletedBy columns for soft-delete compliance
-- Date: 2026-08-13

-- ─── Add Soft-Delete Columns ────────────────────────────────────────────────────

-- Add deleted_at timestamp for soft-delete filtering
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deleted_by to track who soft-deleted the payment
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- ─── Performance Index for Soft-Delete Queries ──────────────────────────────────

-- Partial index for active (non-deleted) payment queries
-- Covers: All payment list/sum queries that filter by deletedAt IS NULL
CREATE INDEX IF NOT EXISTS payments_active_idx
ON payments (student_id, assessment_id)
WHERE deleted_at IS NULL;
