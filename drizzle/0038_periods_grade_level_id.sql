-- Migration: Switch periods from assessment_band to grade_level_id
-- This allows each grade level to have its own unique bell schedule

-- Step 1: Add grade_level_id column to periods table
ALTER TABLE "periods" ADD COLUMN "grade_level_id" uuid;

-- Step 2: Add foreign key constraint
ALTER TABLE "periods" ADD CONSTRAINT "periods_grade_level_id_grade_levels_id_fk"
  FOREIGN KEY ("grade_level_id") REFERENCES "grade_levels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Step 3: Create index for grade_level_id lookups
CREATE INDEX "periods_gl_idx" ON "periods" ("grade_level_id");

-- Step 4: Migrate existing data - map period names to grade level names
-- This maps periods whose names match grade level names (e.g., "Junior Casa" period → "Junior Casa" grade level)
UPDATE "periods" p
SET "grade_level_id" = gl.id
FROM "grade_levels" gl
WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(gl.name))
  AND p."grade_level_id" IS NULL;

-- Step 5: For periods with assessment_band set, try to match by band to first grade level in that band
-- Only for periods that still don't have a grade_level_id assigned
UPDATE "periods" p
SET "grade_level_id" = (
  SELECT gl.id FROM "grade_levels" gl
  WHERE gl."assessment_band" = p."assessment_band"
  ORDER BY gl."order" ASC
  LIMIT 1
)
WHERE p."grade_level_id" IS NULL
  AND p."assessment_band" IS NOT NULL;

-- Step 6: Drop old assessment_band-related constraints and indexes
DROP INDEX IF EXISTS "periods_sy_num_band_uidx";

-- Step 7: Remove assessment_band column from periods table
ALTER TABLE "periods" DROP COLUMN IF EXISTS "assessment_band";

-- Step 8: Create new unique index for school year + period number + grade level
CREATE UNIQUE INDEX "periods_sy_num_gl_uidx"
  ON "periods" ("school_year_id", "period_number", "grade_level_id")
  WHERE "deleted_at" IS NULL;
