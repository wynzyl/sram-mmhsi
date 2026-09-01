-- Migration: Add Special Education (SPED) fields
-- Purpose: Support SPED students with additional fee tracking
-- - students.is_special_education: Default SPED status for the student
-- - enrollments.special_education_override: Per-enrollment override (null = inherit from student)

-- Add SPED flag to students table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'students' AND column_name = 'is_special_education') THEN
    ALTER TABLE "students" ADD COLUMN "is_special_education" boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add SPED override to enrollments table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'special_education_override') THEN
    ALTER TABLE "enrollments" ADD COLUMN "special_education_override" boolean;
  END IF;
END $$;

-- Add index for SPED student queries (idempotent)
CREATE INDEX IF NOT EXISTS "students_sped_idx" ON "students" ("is_special_education") WHERE "is_special_education" = true;

COMMENT ON COLUMN "students"."is_special_education" IS 'Whether this student requires Special Education (SPED) services';
COMMENT ON COLUMN "enrollments"."special_education_override" IS 'Override the student default SPED status for this enrollment. NULL = inherit from student, true = force SPED, false = force non-SPED';
