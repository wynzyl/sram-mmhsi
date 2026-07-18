CREATE TYPE "public"."grade_approval_action" AS ENUM('submit', 'return', 'approve', 'release', 'unlock');--> statement-breakpoint
CREATE TYPE "public"."grade_sheet_status" AS ENUM('draft', 'submitted', 'returned', 'approved', 'released');--> statement-breakpoint
CREATE TYPE "public"."grading_period" AS ENUM('Q1', 'Q2', 'Q3', 'Q4');--> statement-breakpoint
CREATE TABLE "grade_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_sheet_id" uuid NOT NULL,
	"action" "grade_approval_action" NOT NULL,
	"remarks" text,
	"actor_id" uuid NOT NULL,
	"actor_role" "role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_sheet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_sheet_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"grade" numeric(5, 2),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_assignment_id" uuid NOT NULL,
	"grading_period" "grading_period" NOT NULL,
	"status" "grade_sheet_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp,
	"submitted_by" uuid,
	"returned_at" timestamp,
	"returned_by" uuid,
	"return_remarks" text,
	"approved_at" timestamp,
	"approved_by" uuid,
	"released_at" timestamp,
	"released_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
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
);
--> statement-breakpoint
ALTER TABLE "grade_approvals" ADD CONSTRAINT "grade_approvals_grade_sheet_id_grade_sheets_id_fk" FOREIGN KEY ("grade_sheet_id") REFERENCES "public"."grade_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_approvals" ADD CONSTRAINT "grade_approvals_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheet_entries" ADD CONSTRAINT "grade_sheet_entries_grade_sheet_id_grade_sheets_id_fk" FOREIGN KEY ("grade_sheet_id") REFERENCES "public"."grade_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheet_entries" ADD CONSTRAINT "grade_sheet_entries_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_teacher_assignment_id_teacher_assignments_id_fk" FOREIGN KEY ("teacher_assignment_id") REFERENCES "public"."teacher_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_returned_by_users_id_fk" FOREIGN KEY ("returned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_sheets" ADD CONSTRAINT "grade_sheets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_advisers" ADD CONSTRAINT "section_advisers_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grade_approvals_sheet_idx" ON "grade_approvals" USING btree ("grade_sheet_id");--> statement-breakpoint
CREATE INDEX "grade_approvals_actor_idx" ON "grade_approvals" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "grade_approvals_created_idx" ON "grade_approvals" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_sheet_entries_sheet_student_uidx" ON "grade_sheet_entries" USING btree ("grade_sheet_id","student_id");--> statement-breakpoint
CREATE INDEX "grade_sheet_entries_student_idx" ON "grade_sheet_entries" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_sheets_assignment_period_uidx" ON "grade_sheets" USING btree ("teacher_assignment_id","grading_period");--> statement-breakpoint
CREATE INDEX "grade_sheets_status_idx" ON "grade_sheets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "grade_sheets_sy_status_idx" ON "grade_sheets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "section_advisers_section_sy_uidx" ON "section_advisers" USING btree ("section_id","school_year_id") WHERE "section_advisers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "section_advisers_user_idx" ON "section_advisers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "section_advisers_sy_idx" ON "section_advisers" USING btree ("school_year_id");