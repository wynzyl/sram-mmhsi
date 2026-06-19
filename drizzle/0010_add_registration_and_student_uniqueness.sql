-- Migration: Add registration uniqueness constraint and student name+DOB uniqueness
-- Purpose: Database-level enforcement to prevent duplicate registrations per school year
--          and duplicate students with same name + date of birth

-- 1. Registration uniqueness: One active registration per student per school year
-- Excludes rejected registrations (can re-register after rejection)
CREATE UNIQUE INDEX IF NOT EXISTS "registrations_student_sy_active_uidx"
  ON "registrations" ("student_id", "school_year_id")
  WHERE "status" != 'rejected';--> statement-breakpoint

-- 2. Student uniqueness: Prevent duplicate students with same name + DOB
-- Uses LOWER() for case-insensitive matching
-- Only applies to active students (deletedAt IS NULL)
-- Requires dateOfBirth to be NOT NULL (nulls excluded from uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS "students_name_dob_active_uidx"
  ON "students" (LOWER("first_name"), LOWER("last_name"), "date_of_birth")
  WHERE "deleted_at" IS NULL AND "date_of_birth" IS NOT NULL;--> statement-breakpoint

-- 3. Add index to support the uniqueness constraint queries efficiently
-- This composite index helps when checking for existing students before insert
CREATE INDEX IF NOT EXISTS "students_name_dob_lookup_idx"
  ON "students" (LOWER("first_name"), LOWER("last_name"), "date_of_birth")
  WHERE "is_active" = true;
