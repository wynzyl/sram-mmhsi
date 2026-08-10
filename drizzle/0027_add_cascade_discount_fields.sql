-- Migration: Add cascade discount calculation fields
-- This migration adds fields to support cascading discount calculations:
-- When cash discount is applied at payment time, existing scholarship discounts
-- are recalculated based on the discounted tuition amount.

-- ============================================
-- 1. discount_types: Add cascade tracking fields
-- ============================================

-- Priority for cascading discount calculations (lower = applied first)
ALTER TABLE "discount_types" ADD COLUMN "cascade_priority" integer;

-- Flag indicating this is the cash payment discount type
ALTER TABLE "discount_types" ADD COLUMN "is_cash_discount" boolean NOT NULL DEFAULT false;

-- Unique constraint: only one cash discount type can exist
CREATE UNIQUE INDEX "discount_types_cash_discount_uidx"
  ON "discount_types" ("is_cash_discount")
  WHERE "is_cash_discount" = true AND "deleted_at" IS NULL;

-- ============================================
-- 2. student_discounts: Add cascade adjustment tracking
-- ============================================

-- The adjustment amount when this discount is affected by cascading
ALTER TABLE "student_discounts" ADD COLUMN "cascade_adjustment_amount" numeric(12, 2);

-- Links to the cash discount that triggered the cascade
ALTER TABLE "student_discounts" ADD COLUMN "cascade_triggered_by_discount_id" uuid;

-- PERFORMANCE: Index for finding discounts affected by a specific cash discount
CREATE INDEX "student_discounts_cascade_trigger_idx"
  ON "student_discounts" ("cascade_triggered_by_discount_id")
  WHERE "cascade_triggered_by_discount_id" IS NOT NULL;

-- ============================================
-- 3. assessment_items: Add cascade adjustment tracking
-- ============================================

-- Flag indicating this is a cascade adjustment item
ALTER TABLE "assessment_items" ADD COLUMN "is_cascade_adjustment" boolean NOT NULL DEFAULT false;

-- Links to the original discount assessment item this adjustment offsets
ALTER TABLE "assessment_items" ADD COLUMN "adjusts_item_id" uuid;

-- PERFORMANCE: Index for cascade adjustment lookups
CREATE INDEX "ai_cascade_adjustment_idx"
  ON "assessment_items" ("adjusts_item_id")
  WHERE "is_cascade_adjustment" = true;

-- ============================================
-- 4. Set FULL_PAYMENT_DISCOUNT as the cash discount
-- ============================================

-- Mark the existing full payment discount as the cash discount type
UPDATE "discount_types"
SET "is_cash_discount" = true, "cascade_priority" = 0
WHERE "code" = 'FULL_PAYMENT_DISCOUNT' AND "deleted_at" IS NULL;
