-- Migration: Add grade_group column to periods for group-based period assignment
-- This allows periods to be assigned to grade groups (casa, elementary, jhs, shs)
-- in addition to universal (all grades) and specific grade level assignment.

-- Step 1: Create the period_grade_group enum
DO $$ BEGIN
  CREATE TYPE "period_grade_group" AS ENUM ('casa', 'elementary', 'jhs', 'shs');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add grade_group column to periods table
ALTER TABLE "periods" ADD COLUMN IF NOT EXISTS "grade_group" "period_grade_group";

-- Step 3: Create index for grade_group lookups
DROP INDEX IF EXISTS "periods_gg_idx";
CREATE INDEX "periods_gg_idx" ON "periods" ("grade_group");

-- Step 4: Drop old unique index that doesn't include grade_group
DROP INDEX IF EXISTS "periods_sy_num_gl_uidx";

-- Step 5: Create new unique index for school year + period number + grade group + grade level
DROP INDEX IF EXISTS "periods_sy_num_gg_gl_uidx";
CREATE UNIQUE INDEX "periods_sy_num_gg_gl_uidx"
  ON "periods" ("school_year_id", "period_number", "grade_group", "grade_level_id")
  WHERE "deleted_at" IS NULL;
