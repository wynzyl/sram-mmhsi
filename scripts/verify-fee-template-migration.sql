-- Fee Template Migration Verification Queries
-- Run these queries to verify the migration was successful

-- ════════════════════════════════════════════════════════════════════════════
-- PRE-MIGRATION VERIFICATION
-- ════════════════════════════════════════════════════════════════════════════

-- Count existing fee schedules
SELECT 'Old fee_schedules count:' as check_name, COUNT(*) as count
FROM fee_schedules;

-- Count fee schedule items
SELECT 'Old fee_schedule_items count:' as check_name, COUNT(*) as count
FROM fee_schedule_items;

-- Count assessment items (must be preserved)
SELECT 'assessment_items count (must match after migration):' as check_name, COUNT(*) as count
FROM assessment_items;

-- Show assessment items with their current references
SELECT
  'assessment_items with feeScheduleItemId:' as check_name,
  COUNT(*) as count
FROM assessment_items
WHERE fee_schedule_item_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION
-- ════════════════════════════════════════════════════════════════════════════

-- Verify new tables created
SELECT 'fee_item_types table exists:' as check_name, COUNT(*) > 0 as exists
FROM information_schema.tables
WHERE table_name = 'fee_item_types';

SELECT 'fee_templates table exists:' as check_name, COUNT(*) > 0 as exists
FROM information_schema.tables
WHERE table_name = 'fee_templates';

SELECT 'fee_template_items table exists:' as check_name, COUNT(*) > 0 as exists
FROM information_schema.tables
WHERE table_name = 'fee_template_items';

SELECT 'school_year_fee_schedules table exists:' as check_name, COUNT(*) > 0 as exists
FROM information_schema.tables
WHERE table_name = 'school_year_fee_schedules';

SELECT 'fee_schedule_overrides table exists:' as check_name, COUNT(*) > 0 as exists
FROM information_schema.tables
WHERE table_name = 'fee_schedule_overrides';

-- Verify old tables dropped (should return 0)
SELECT 'fee_schedules table dropped:' as check_name, COUNT(*) = 0 as dropped
FROM information_schema.tables
WHERE table_name = 'fee_schedules';

SELECT 'fee_schedule_items table dropped:' as check_name, COUNT(*) = 0 as dropped
FROM information_schema.tables
WHERE table_name = 'fee_schedule_items';

-- Verify fee item types seeded
SELECT 'fee_item_types count (should be 13):' as check_name, COUNT(*) as count
FROM fee_item_types;

-- Show all fee item types
SELECT code, name, category, is_discount, display_order
FROM fee_item_types
ORDER BY display_order;

-- Verify data migrated (if migration was run)
SELECT 'fee_templates count:' as check_name, COUNT(*) as count
FROM fee_templates;

SELECT 'fee_template_items count:' as check_name, COUNT(*) as count
FROM fee_template_items;

SELECT 'school_year_fee_schedules count:' as check_name, COUNT(*) as count
FROM school_year_fee_schedules;

-- Verify assessment_items references updated
SELECT
  'assessment_items with feeTemplateItemId:' as check_name,
  COUNT(*) as count
FROM assessment_items
WHERE fee_template_item_id IS NOT NULL;

SELECT
  'assessment_items with feeItemTypeId:' as check_name,
  COUNT(*) as count
FROM assessment_items
WHERE fee_item_type_id IS NOT NULL;

-- Verify no orphaned assessment items
SELECT
  'assessment_items orphaned (should be 0):' as check_name,
  COUNT(*) as count
FROM assessment_items
WHERE fee_template_item_id IS NULL
  AND fee_schedule_item_id IS NULL;

-- Verify all assessment_items can join to fee_template_items
SELECT
  'assessment_items with valid feeTemplateItemId:' as check_name,
  COUNT(*) as count
FROM assessment_items ai
JOIN fee_template_items fti ON ai.fee_template_item_id = fti.id;

-- Verify all assessment_items can join to fee_item_types
SELECT
  'assessment_items with valid feeItemTypeId:' as check_name,
  COUNT(*) as count
FROM assessment_items ai
JOIN fee_item_types fit ON ai.fee_item_type_id = fit.id;

-- ════════════════════════════════════════════════════════════════════════════
-- DATA INTEGRITY CHECKS
-- ════════════════════════════════════════════════════════════════════════════

-- Check for duplicate fee types in templates (should be 0)
SELECT
  'Templates with duplicate fee types (should be 0):' as check_name,
  COUNT(*) as count
FROM (
  SELECT fee_template_id, fee_item_type_id, COUNT(*) as dupes
  FROM fee_template_items
  GROUP BY fee_template_id, fee_item_type_id
  HAVING COUNT(*) > 1
) duplicates;

-- Check for templates with no items (should be 0 after seeding)
SELECT
  'Templates with no items (should be 0):' as check_name,
  COUNT(*) as count
FROM fee_templates ft
LEFT JOIN fee_template_items fti ON ft.id = fti.fee_template_id
WHERE fti.id IS NULL;

-- Check for multiple active schedules per (school year, band) - should be 0
SELECT
  'Multiple active schedules per (SY, band) (should be 0):' as check_name,
  COUNT(*) as count
FROM (
  SELECT school_year_id, assessment_band, COUNT(*) as active_count
  FROM school_year_fee_schedules
  WHERE is_active = true
  GROUP BY school_year_id, assessment_band
  HAVING COUNT(*) > 1
) duplicates;

-- Show summary by assessment band
SELECT
  ft.assessment_band,
  COUNT(DISTINCT ft.id) as template_count,
  COUNT(DISTINCT fti.id) as total_items,
  COUNT(DISTINCT syfs.id) as schedule_assignments
FROM fee_templates ft
LEFT JOIN fee_template_items fti ON ft.id = fti.fee_template_id
LEFT JOIN school_year_fee_schedules syfs ON ft.id = syfs.fee_template_id
GROUP BY ft.assessment_band
ORDER BY ft.assessment_band;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK VERIFICATION
-- ════════════════════════════════════════════════════════════════════════════

-- If rollback was performed, verify old tables restored
-- (These queries will fail if new system is active, which is expected)

-- SELECT 'Old tables restored:' as check_name, COUNT(*) > 0 as restored
-- FROM fee_schedules;

-- SELECT 'Old items restored:' as check_name, COUNT(*) > 0 as restored
-- FROM fee_schedule_items;
