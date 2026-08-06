-- Migration: Refactor Strands for SHS Track-Based Curriculum
-- Description: Convert strands to admin-managed tracks with direct subject ownership
-- Changes:
--   1. strands.code: enum → text (allow custom track codes)
--   2. strands.short_code: new column for display abbreviation
--   3. strands.track_category: new column (academic, tvl, specialized)
--   4. subjects.strand_id: direct ownership for SHS subjects
--   5. subjects.term_offered: when subject is offered (uses existing enum)

-- ─── Step 1: Refactor strands.code from enum to text ─────────────────────────────

-- Drop existing unique index that uses the enum
DROP INDEX IF EXISTS "strands_code_uidx";

-- Add temporary text column and migrate data
ALTER TABLE "strands" ADD COLUMN "code_text" text;

-- Copy existing enum values to text column
UPDATE "strands" SET "code_text" = "code"::text;

-- Drop the old enum column (requires dropping the default if any)
ALTER TABLE "strands" DROP COLUMN "code";

-- Rename the text column to code
ALTER TABLE "strands" RENAME COLUMN "code_text" TO "code";

-- Make code NOT NULL
ALTER TABLE "strands" ALTER COLUMN "code" SET NOT NULL;

-- Recreate unique index on text column
CREATE UNIQUE INDEX "strands_code_uidx"
    ON "strands" ("code") WHERE "deleted_at" IS NULL;

-- ─── Step 2: Add new columns to strands ──────────────────────────────────────────

-- Short code for UI badges (e.g., "STEM" for full code "STEM", "ICT" for "TVL-ICT")
ALTER TABLE "strands" ADD COLUMN IF NOT EXISTS "short_code" text;

-- Track category for grouping (academic, tvl, specialized)
ALTER TABLE "strands" ADD COLUMN IF NOT EXISTS "track_category" text;

-- Add check constraint for track_category
ALTER TABLE "strands" ADD CONSTRAINT "strands_track_category_chk"
    CHECK ("track_category" IN ('academic', 'tvl', 'specialized') OR "track_category" IS NULL);

-- Backfill short_code from existing codes
UPDATE "strands" SET "short_code" =
    CASE
        WHEN "code" LIKE 'TVL-%' THEN SUBSTRING("code" FROM 5)
        ELSE "code"
    END
WHERE "short_code" IS NULL;

-- Backfill track_category from existing codes
UPDATE "strands" SET "track_category" =
    CASE
        WHEN "code" LIKE 'TVL-%' THEN 'tvl'
        ELSE 'academic'
    END
WHERE "track_category" IS NULL;

-- Make short_code NOT NULL after backfill
ALTER TABLE "strands" ALTER COLUMN "short_code" SET NOT NULL;

-- Make track_category NOT NULL after backfill
ALTER TABLE "strands" ALTER COLUMN "track_category" SET NOT NULL;

-- Add unique index for short_code (active records only)
CREATE UNIQUE INDEX IF NOT EXISTS "strands_short_code_uidx"
    ON "strands" ("short_code") WHERE "deleted_at" IS NULL;

-- ─── Step 3: Add strand_id and term_offered to subjects ──────────────────────────

-- Direct track ownership for SHS subjects (nullable for non-SHS subjects)
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "strand_id" uuid;

-- Add foreign key constraint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_strand_fk"
    FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE SET NULL;

-- Term offered for SHS subjects (defaults to full_year)
-- Note: term_offering enum already exists from migration 0021
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "term_offered" "term_offering" NOT NULL DEFAULT 'full_year';

-- Performance index for strand-based queries
CREATE INDEX IF NOT EXISTS "subjects_strand_idx"
    ON "subjects" ("strand_id") WHERE "deleted_at" IS NULL;

-- Composite index for curriculum + strand queries (SHS curriculum management)
CREATE INDEX IF NOT EXISTS "subjects_curriculum_strand_idx"
    ON "subjects" ("curriculum_id", "strand_id") WHERE "deleted_at" IS NULL;

-- ─── Step 4: Add strand_id to sections (track-based sections) ────────────────────

-- Allow sections to be associated with a specific track (for SHS)
ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "strand_id" uuid;

-- Add foreign key constraint
ALTER TABLE "sections" ADD CONSTRAINT "sections_strand_fk"
    FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE SET NULL;

-- Index for strand-based section queries
CREATE INDEX IF NOT EXISTS "sections_strand_idx"
    ON "sections" ("strand_id") WHERE "deleted_at" IS NULL;

-- ─── Cleanup: Drop the now-unused strand_code enum ───────────────────────────────
-- Note: We keep this commented as other parts of the codebase may still reference it
-- The enum will be deprecated and can be removed in a future migration
-- DROP TYPE IF EXISTS "strand_code";
