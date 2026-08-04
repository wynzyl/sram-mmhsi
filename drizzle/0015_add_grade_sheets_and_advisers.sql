-- Add coordinator and principal roles to role enum
ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'coordinator';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'principal';--> statement-breakpoint

-- Create grading system type enum (quarterly or trimester)
CREATE TYPE "public"."grading_system_type" AS ENUM('quarterly', 'trimester');--> statement-breakpoint

-- Create grade group enum (coordinator level groupings)
CREATE TYPE "public"."grade_group" AS ENUM('casa', 'lower_elem', 'higher_elem', 'jhs', 'shs');--> statement-breakpoint

-- Create grading period enum with both quarters and trimesters
CREATE TYPE "public"."grading_period" AS ENUM('Q1', 'Q2', 'Q3', 'Q4', 'T1', 'T2', 'T3');--> statement-breakpoint

-- Create grade sheet status enum with full approval workflow
CREATE TYPE "public"."grade_sheet_status" AS ENUM('draft', 'submitted', 'coordinator_approved', 'principal_approved', 'published', 'locked', 'returned');--> statement-breakpoint

-- Create grade approval action enum
CREATE TYPE "public"."grade_approval_action" AS ENUM('submit', 'coordinator_return', 'coordinator_approve', 'principal_return', 'principal_approve', 'publish', 'lock', 'unlock');--> statement-breakpoint

-- Create section advisers table
CREATE TABLE "section_advisers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);--> statement-breakpoint

-- Create grade sheets table (per section per school year per grading period)
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
);--> statement-breakpoint

-- Create grade sheet entries table (per student per subject per grade sheet)
CREATE TABLE "grade_sheet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_sheet_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"grade" numeric(5, 2),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create grade approvals audit trail table
CREATE TABLE "grade_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_sheet_id" uuid NOT NULL,
	"action" "grade_approval_action" NOT NULL,
	"remarks" text,
	"actor_id" uuid NOT NULL,
	"actor_role" "role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create grading period systems table (quarterly or trimester per school year)
CREATE TABLE "grading_period_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"system_type" "grading_system_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);--> statement-breakpoint

-- Create coordinator assignments table
CREATE TABLE "coordinator_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"grade_group" "grade_group" NOT NULL,
	"school_year_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);--> statement-breakpoint

-- Add foreign keys for section_advisers
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Add foreign keys for grade_sheets
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_adviser_id_users_id_fk" FOREIGN KEY ("adviser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_coordinator_approved_by_users_id_fk" FOREIGN KEY ("coordinator_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_principal_approved_by_users_id_fk" FOREIGN KEY ("principal_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_returned_by_users_id_fk" FOREIGN KEY ("returned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Add foreign keys for grade_sheet_entries
ALTER TABLE "grade_sheet_entries" ADD CONSTRAINT "grade_sheet_entries_grade_sheet_id_grade_sheets_id_fk" FOREIGN KEY ("grade_sheet_id") REFERENCES "public"."grade_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheet_entries" ADD CONSTRAINT "grade_sheet_entries_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheet_entries" ADD CONSTRAINT "grade_sheet_entries_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Add foreign keys for grade_approvals
ALTER TABLE "grade_approvals" ADD CONSTRAINT "grade_approvals_grade_sheet_id_grade_sheets_id_fk" FOREIGN KEY ("grade_sheet_id") REFERENCES "public"."grade_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_approvals" ADD CONSTRAINT "grade_approvals_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Add foreign keys for grading_period_systems
ALTER TABLE "grading_period_systems" ADD CONSTRAINT "grading_period_systems_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_period_systems" ADD CONSTRAINT "grading_period_systems_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_period_systems" ADD CONSTRAINT "grading_period_systems_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Add foreign keys for coordinator_assignments
ALTER TABLE "coordinator_assignments" ADD CONSTRAINT "coordinator_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordinator_assignments" ADD CONSTRAINT "coordinator_assignments_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordinator_assignments" ADD CONSTRAINT "coordinator_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordinator_assignments" ADD CONSTRAINT "coordinator_assignments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Create indexes for section_advisers
CREATE UNIQUE INDEX "section_advisers_section_sy_uidx" ON "section_advisers" USING btree ("section_id","school_year_id") WHERE "section_advisers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "section_advisers_user_idx" ON "section_advisers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "section_advisers_sy_idx" ON "section_advisers" USING btree ("school_year_id");--> statement-breakpoint

-- Create indexes for grade_sheets
CREATE UNIQUE INDEX "grade_sheets_section_sy_period_uidx" ON "grade_sheets" USING btree ("section_id","school_year_id","grading_period");--> statement-breakpoint
CREATE INDEX "grade_sheets_status_idx" ON "grade_sheets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "grade_sheets_sy_status_idx" ON "grade_sheets" USING btree ("school_year_id","status");--> statement-breakpoint
CREATE INDEX "grade_sheets_adviser_idx" ON "grade_sheets" USING btree ("adviser_id");--> statement-breakpoint

-- Create indexes for grade_sheet_entries
CREATE UNIQUE INDEX "grade_sheet_entries_sheet_student_subject_uidx" ON "grade_sheet_entries" USING btree ("grade_sheet_id","student_id","subject_id");--> statement-breakpoint
CREATE INDEX "grade_sheet_entries_student_idx" ON "grade_sheet_entries" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "grade_sheet_entries_subject_idx" ON "grade_sheet_entries" USING btree ("subject_id");--> statement-breakpoint

-- Create indexes for grade_approvals
CREATE INDEX "grade_approvals_sheet_idx" ON "grade_approvals" USING btree ("grade_sheet_id");--> statement-breakpoint
CREATE INDEX "grade_approvals_actor_idx" ON "grade_approvals" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "grade_approvals_created_idx" ON "grade_approvals" USING btree ("created_at");--> statement-breakpoint

-- Create indexes for grading_period_systems
CREATE UNIQUE INDEX "grading_period_systems_sy_uidx" ON "grading_period_systems" USING btree ("school_year_id");--> statement-breakpoint

-- Create indexes for coordinator_assignments
CREATE UNIQUE INDEX "coordinator_assignments_group_sy_uidx" ON "coordinator_assignments" USING btree ("grade_group","school_year_id") WHERE "coordinator_assignments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "coordinator_assignments_user_idx" ON "coordinator_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "coordinator_assignments_sy_idx" ON "coordinator_assignments" USING btree ("school_year_id");
