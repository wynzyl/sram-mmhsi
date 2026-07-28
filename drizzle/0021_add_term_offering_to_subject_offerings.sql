-- Migration: Add term_offering to subject_offerings
-- Purpose: Support term-based subject offerings for SHS (Grade 11-12)
-- Allows subjects to be offered in specific semesters/trimesters

-- Create the term_offering enum type
DO $$ BEGIN
  CREATE TYPE "term_offering" AS ENUM (
    'full_year',
    'first_semester',
    'second_semester',
    'first_trimester',
    'second_trimester',
    'third_trimester'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add term_offered column with default 'full_year'
-- All existing offerings default to full_year (backward compatible)
ALTER TABLE "subject_offerings"
ADD COLUMN "term_offered" "term_offering" NOT NULL DEFAULT 'full_year';

-- Add index for queries filtering by term
CREATE INDEX "subject_offerings_term_offered_idx"
ON "subject_offerings" ("term_offered");

COMMENT ON COLUMN "subject_offerings"."term_offered" IS
'Term when this subject is offered (SHS only). full_year = offered all periods. semester/trimester values limit to specific periods.';
