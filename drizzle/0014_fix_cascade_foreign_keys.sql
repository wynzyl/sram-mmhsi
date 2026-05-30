-- Migration: Fix CASCADE foreign keys to enforce soft delete at database level
-- Rationale: Prevent silent data loss if parent records are deleted directly in DB
-- All application-level code already uses soft delete (verified via audit).
-- This migration changes FK behavior from CASCADE to RESTRICT as a defense-in-depth measure.
-- Note: sessions.userId keeps CASCADE - sessions are ephemeral and can be cleaned up with users.

-- 1. fee_schedule_items → fee_schedules (MEDIUM risk)
ALTER TABLE "fee_schedule_items"
  DROP CONSTRAINT IF EXISTS "fee_schedule_items_fee_schedule_id_fee_schedules_id_fk",
  ADD CONSTRAINT "fee_schedule_items_fee_schedule_id_fee_schedules_id_fk"
    FOREIGN KEY ("fee_schedule_id") REFERENCES "fee_schedules"("id") ON DELETE RESTRICT;

-- 2. fee_template_items → fee_templates (MEDIUM risk)
ALTER TABLE "fee_template_items"
  DROP CONSTRAINT IF EXISTS "fee_template_items_fee_template_id_fee_templates_id_fk",
  ADD CONSTRAINT "fee_template_items_fee_template_id_fee_templates_id_fk"
    FOREIGN KEY ("fee_template_id") REFERENCES "fee_templates"("id") ON DELETE RESTRICT;

-- 3. school_year_fee_schedules → school_years (MEDIUM risk)
ALTER TABLE "school_year_fee_schedules"
  DROP CONSTRAINT IF EXISTS "school_year_fee_schedules_school_year_id_school_years_id_fk",
  ADD CONSTRAINT "school_year_fee_schedules_school_year_id_school_years_id_fk"
    FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT;

-- 4. fee_schedule_overrides → school_year_fee_schedules (MEDIUM risk)
ALTER TABLE "fee_schedule_overrides"
  DROP CONSTRAINT IF EXISTS "fee_schedule_overrides_schedule_id_school_year_fee_schedules_id_fk",
  ADD CONSTRAINT "fee_schedule_overrides_schedule_id_school_year_fee_schedules_id_fk"
    FOREIGN KEY ("schedule_id") REFERENCES "school_year_fee_schedules"("id") ON DELETE RESTRICT;

-- 5. assessment_items → assessments (HIGH risk - financial audit trail)
ALTER TABLE "assessment_items"
  DROP CONSTRAINT IF EXISTS "assessment_items_assessment_id_assessments_id_fk",
  ADD CONSTRAINT "assessment_items_assessment_id_assessments_id_fk"
    FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT;

-- 6. payment_allocations → payments (HIGH risk - financial audit trail)
ALTER TABLE "payment_allocations"
  DROP CONSTRAINT IF EXISTS "payment_allocations_payment_id_payments_id_fk",
  ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT;

-- 7. Add soft delete fields to parents_guardians table (consistency fix)
ALTER TABLE "parents_guardians"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deleted_by" UUID REFERENCES "users"("id");

-- 8. Create partial index for active parents/guardians (soft delete optimization)
CREATE INDEX IF NOT EXISTS "pg_deleted_at_idx" ON "parents_guardians"("deleted_at")
  WHERE "deleted_at" IS NULL;
