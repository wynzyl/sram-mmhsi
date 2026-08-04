-- Migration: Add composite indexes for reconciliation and dashboard queries
-- Identified in SRAMS Performance Architecture Audit (2026-07-29)
-- Expected impact: 30-50% query latency reduction for dashboard/reconciliation

-- 1. Payment reconciliation by date + method
-- Speeds up daily cash reconciliation reports and payment method analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_date_method_posted_idx
ON payments (payment_date, payment_method)
WHERE status = 'posted';

-- 2. Assessment outstanding balance lookup by school year
-- Speeds up finance dashboard and accounts receivable reports
-- Filters to active (non-cancelled, non-transferred) assessments
CREATE INDEX CONCURRENTLY IF NOT EXISTS assessments_sy_outstanding_idx
ON assessments (school_year_id, billing_status, balance)
WHERE cancelled_at IS NULL AND transferred_at IS NULL;

-- 3. Discount request processing queue
-- Speeds up finance officer's pending discount approval list
-- Ordered by creation date for FIFO processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS discount_requests_pending_created_idx
ON discount_requests (status, created_at)
WHERE status = 'pending';

-- 4. Grade sheet review queue for principal
-- Speeds up principal's pending grade sheet approval dashboard
-- Filters to submitted sheets ordered by submission date
CREATE INDEX CONCURRENTLY IF NOT EXISTS grade_sheets_pending_review_idx
ON grade_sheets (school_year_id, status, submitted_at)
WHERE status = 'submitted';

-- 5. Student document request history
-- Speeds up document request listing by student (archive module)
-- Partial index excludes soft-deleted records
CREATE INDEX CONCURRENTLY IF NOT EXISTS doc_requests_student_history_idx
ON document_requests (student_id, status, requested_at)
WHERE deleted_at IS NULL;

-- 6. Payment booklet lookup for cashier
-- Speeds up active booklet selection dropdown
CREATE INDEX CONCURRENTLY IF NOT EXISTS booklets_active_usage_idx
ON receipt_booklets (status, usage_mode)
WHERE status = 'active';

-- 7. Enrollment cancellation request queue
-- Speeds up admin approval queue for cancellation requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS ecr_pending_created_idx
ON enrollment_cancellation_requests (status, requested_at)
WHERE status = 'pending' AND deleted_at IS NULL;

-- 8. Student clearance lookup for document release
-- Speeds up clearance check during document release eligibility
CREATE INDEX CONCURRENTLY IF NOT EXISTS clearances_student_pending_idx
ON student_clearances (student_id, status)
WHERE status = 'pending' AND deleted_at IS NULL;
