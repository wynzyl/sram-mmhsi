-- Migration: Add Special Education (SPED) fields
-- Purpose: Support SPED students with additional fee tracking
-- - students.is_special_education: Default SPED status for the student
-- - enrollments.special_education_override: Per-enrollment override (null = inherit from student)

-- Add SPED flag to students table
ALTER TABLE "students" ADD COLUMN "is_special_education" boolean NOT NULL DEFAULT false;

-- Add SPED override to enrollments table (nullable for inheritance from student)
ALTER TABLE "enrollments" ADD COLUMN "special_education_override" boolean;

-- Add index for SPED student queries
CREATE INDEX "students_sped_idx" ON "students" ("is_special_education") WHERE "is_special_education" = true;

COMMENT ON COLUMN "students"."is_special_education" IS 'Whether this student requires Special Education (SPED) services';
COMMENT ON COLUMN "enrollments"."special_education_override" IS 'Override the student default SPED status for this enrollment. NULL = inherit from student, true = force SPED, false = force non-SPED';
