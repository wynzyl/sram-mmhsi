# Archived Migrations

This directory contains the original 17 incremental migrations (0000-0016) that were consolidated into a single baseline migration on 2026-06-18.

## Why Archived?

The original migrations accumulated over development and included:
- Initial baseline schema
- Performance indexes
- Soft delete additions
- Void requests and reversal tracking
- Balance forward features
- Student reference sequences
- Discount system
- Registration uniqueness constraints
- Enrollment cancellation features
- Cascade foreign key fixes

## Files Archived

| File | Description |
|------|-------------|
| `0000_baseline_schema.sql` | Original baseline with core tables |
| `0001_add_performance_indexes.sql` | Payment and assessment indexes |
| `0002_add_soft_delete_to_fee_template_items.sql` | Soft delete for fee templates |
| `0003_add_void_requests_and_reversal.sql` | Void workflow support |
| `0004_add_balance_forward_payment_kind_and_billing_status.sql` | BFX payment type |
| `0005_add_student_ref_sequence.sql` | Student reference number sequence |
| `0006_add_bfx_reference_sequence.sql` | Balance forward reference sequence |
| `0007_add_discount_system.sql` | Discount types and applications |
| `0008_add_student_discount_index.sql` | Discount lookup index |
| `0009_discount_reversal_status_and_replacement_link.sql` | Discount reversal tracking |
| `0010_add_registration_and_student_uniqueness.sql` | Uniqueness constraints |
| `0011_fix_assessment_unique_index_for_reassessment.sql` | Assessment index fix |
| `0012_add_enrollment_cancellation_and_clearances.sql` | Cancellation workflow |
| `0013_drop_ecr_enrollment_cascade.sql` | Foreign key cascade fix |
| `0014_add_advance_casa_assessment_band.sql` | Assessment band addition |
| `0015_add_payment_idempotency_key.sql` | Payment idempotency |
| `0016_fix_cascade_foreign_keys.sql` | Final cascade fixes |

## Restoration

If needed for reference, these files can be examined but should NOT be applied to any database that has the consolidated baseline migration.

The `meta/` subdirectory contains the original Drizzle snapshot JSON files that corresponded to each migration.

## Consolidated Migration

The new baseline migration at `drizzle/0000_baseline_schema.sql` contains all schema definitions from these 17 migrations in a single file, suitable for fresh database deployments.
