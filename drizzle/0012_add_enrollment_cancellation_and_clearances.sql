CREATE TYPE "public"."cancellation_reason_type" AS ENUM('transfer', 'financial', 'medical', 'relocation', 'personal', 'administrative', 'non_compliance', 'disciplinary', 'other');--> statement-breakpoint
CREATE TYPE "public"."clearance_status" AS ENUM('cleared', 'pending', 'waived');--> statement-breakpoint
CREATE TYPE "public"."clearance_type" AS ENUM('end_of_year', 'enrollment_cancellation', 'transfer_out', 'graduation', 'other');--> statement-breakpoint
CREATE TYPE "public"."enrollment_cancellation_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."resolution_type" AS ENUM('paid', 'waived', 'written_off');--> statement-breakpoint
CREATE TABLE "enrollment_cancellation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"reason_type" "cancellation_reason_type" NOT NULL,
	"remarks" text,
	"status" "enrollment_cancellation_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_remarks" text,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "student_clearances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"school_year_id" uuid,
	"clearance_type" "clearance_type" NOT NULL,
	"outstanding_amount" numeric(12, 2) NOT NULL,
	"status" "clearance_status" DEFAULT 'pending' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"resolution_type" "resolution_type",
	"resolution_remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "assessment_items" ADD COLUMN "is_refundable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_item_types" ADD COLUMN "is_refundable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollment_cancellation_requests" ADD CONSTRAINT "enrollment_cancellation_requests_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_cancellation_requests" ADD CONSTRAINT "enrollment_cancellation_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_cancellation_requests" ADD CONSTRAINT "enrollment_cancellation_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_cancellation_requests" ADD CONSTRAINT "enrollment_cancellation_requests_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ecr_enrollment_pending_uidx" ON "enrollment_cancellation_requests" USING btree ("enrollment_id") WHERE "enrollment_cancellation_requests"."status" = 'pending' AND "enrollment_cancellation_requests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ecr_enrollment_idx" ON "enrollment_cancellation_requests" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "ecr_status_idx" ON "enrollment_cancellation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ecr_pending_idx" ON "enrollment_cancellation_requests" USING btree ("status","deleted_at") WHERE "enrollment_cancellation_requests"."status" = 'pending' AND "enrollment_cancellation_requests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ecr_requested_by_idx" ON "enrollment_cancellation_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "clearances_student_idx" ON "student_clearances" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "clearances_enrollment_idx" ON "student_clearances" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "clearances_school_year_idx" ON "student_clearances" USING btree ("school_year_id");--> statement-breakpoint
CREATE INDEX "clearances_status_idx" ON "student_clearances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clearances_pending_idx" ON "student_clearances" USING btree ("status") WHERE "student_clearances"."status" = 'pending' AND "student_clearances"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clearances_enrollment_type_uidx" ON "student_clearances" USING btree ("enrollment_id","clearance_type") WHERE "student_clearances"."deleted_at" IS NULL;