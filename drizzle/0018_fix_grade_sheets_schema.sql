-- Fix grade_sheets and related tables schema
-- The old schema was teacher-assignment-based, but the new design is section-based
-- Since there's no data, we can safely drop and recreate

-- First, add missing enum values

-- Add missing grading_period values (T1, T2, T3 for trimester)
ALTER TYPE "grading_period" ADD VALUE IF NOT EXISTS 'T1';
ALTER TYPE "grading_period" ADD VALUE IF NOT EXISTS 'T2';
ALTER TYPE "grading_period" ADD VALUE IF NOT EXISTS 'T3';

-- Add missing grade_sheet_status values
ALTER TYPE "grade_sheet_status" ADD VALUE IF NOT EXISTS 'coordinator_approved';
ALTER TYPE "grade_sheet_status" ADD VALUE IF NOT EXISTS 'principal_approved';
ALTER TYPE "grade_sheet_status" ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE "grade_sheet_status" ADD VALUE IF NOT EXISTS 'locked';

-- Add missing grade_approval_action values
ALTER TYPE "grade_approval_action" ADD VALUE IF NOT EXISTS 'coordinator_return';
ALTER TYPE "grade_approval_action" ADD VALUE IF NOT EXISTS 'coordinator_approve';
ALTER TYPE "grade_approval_action" ADD VALUE IF NOT EXISTS 'principal_return';
ALTER TYPE "grade_approval_action" ADD VALUE IF NOT EXISTS 'principal_approve';
ALTER TYPE "grade_approval_action" ADD VALUE IF NOT EXISTS 'publish';
ALTER TYPE "grade_approval_action" ADD VALUE IF NOT EXISTS 'lock';

-- Drop dependent tables first (due to foreign key constraints)
DROP TABLE IF EXISTS "grade_approvals" CASCADE;
DROP TABLE IF EXISTS "grade_sheet_entries" CASCADE;
DROP TABLE IF EXISTS "grade_sheets" CASCADE;

-- Drop old indexes that may conflict
DROP INDEX IF EXISTS "grade_sheets_assignment_period_uidx";
DROP INDEX IF EXISTS "grade_sheet_entries_sheet_student_uidx";

-- Recreate grade_sheets table with correct schema (section-based)
CREATE TABLE "grade_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"adviser_id" uuid,
	"grading_period" "grading_period" NOT NULL,
	"status" "grade_sheet_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp,
	"submitted_by" uuid,
	"coordinator_approved_at" timestamp,
	"coordinator_approved_by" uuid,
	"principal_approved_at" timestamp,
	"principal_approved_by" uuid,
	"published_at" timestamp,
	"published_by" uuid,
	"locked_at" timestamp,
	"locked_by" uuid,
	"returned_at" timestamp,
	"returned_by" uuid,
	"return_remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);

-- Recreate grade_sheet_entries table with subject_id
CREATE TABLE "grade_sheet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_sheet_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"grade" numeric(5, 2),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Recreate grade_approvals table
CREATE TABLE "grade_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_sheet_id" uuid NOT NULL,
	"action" "grade_approval_action" NOT NULL,
	"remarks" text,
	"actor_id" uuid NOT NULL,
	"actor_role" "role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign keys for grade_sheets
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_adviser_id_users_id_fk" FOREIGN KEY ("adviser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_coordinator_approved_by_users_id_fk" FOREIGN KEY ("coordinator_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_principal_approved_by_users_id_fk" FOREIGN KEY ("principal_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_returned_by_users_id_fk" FOREIGN KEY ("returned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

-- Add foreign keys for grade_sheet_entries
ALTER TABLE "grade_sheet_entries" ADD CONSTRAINT "grade_sheet_entries_grade_sheet_id_grade_sheets_id_fk" FOREIGN KEY ("grade_sheet_id") REFERENCES "public"."grade_sheets"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheet_entries" ADD CONSTRAINT "grade_sheet_entries_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_sheet_entries" ADD CONSTRAINT "grade_sheet_entries_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;

-- Add foreign keys for grade_approvals
ALTER TABLE "grade_approvals" ADD CONSTRAINT "grade_approvals_grade_sheet_id_grade_sheets_id_fk" FOREIGN KEY ("grade_sheet_id") REFERENCES "public"."grade_sheets"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grade_approvals" ADD CONSTRAINT "grade_approvals_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes for grade_sheets
CREATE UNIQUE INDEX "grade_sheets_section_sy_period_uidx" ON "grade_sheets" USING btree ("section_id","school_year_id","grading_period");
CREATE INDEX "grade_sheets_status_idx" ON "grade_sheets" USING btree ("status");
CREATE INDEX "grade_sheets_sy_status_idx" ON "grade_sheets" USING btree ("school_year_id","status");
CREATE INDEX "grade_sheets_adviser_idx" ON "grade_sheets" USING btree ("adviser_id");

-- Create indexes for grade_sheet_entries
CREATE UNIQUE INDEX "grade_sheet_entries_sheet_student_subject_uidx" ON "grade_sheet_entries" USING btree ("grade_sheet_id","student_id","subject_id");
CREATE INDEX "grade_sheet_entries_student_idx" ON "grade_sheet_entries" USING btree ("student_id");
CREATE INDEX "grade_sheet_entries_subject_idx" ON "grade_sheet_entries" USING btree ("subject_id");

-- Create indexes for grade_approvals
CREATE INDEX "grade_approvals_sheet_idx" ON "grade_approvals" USING btree ("grade_sheet_id");
CREATE INDEX "grade_approvals_actor_idx" ON "grade_approvals" USING btree ("actor_id");
CREATE INDEX "grade_approvals_created_idx" ON "grade_approvals" USING btree ("created_at");
