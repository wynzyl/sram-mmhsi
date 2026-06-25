CREATE TYPE "public"."document_request_status" AS ENUM('requested', 'processing', 'ready', 'released', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."document_request_type" AS ENUM('form_137', 'form_138', 'good_moral', 'cert_enrollment', 'cert_completion', 'diploma_copy', 'other');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('active', 'graduated', 'transferred', 'withdrawn', 'cancelled', 'inactive');--> statement-breakpoint
ALTER TYPE "public"."cancellation_reason_type" ADD VALUE 'no_show' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "document_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_year_id" uuid,
	"document_type" "document_request_type" NOT NULL,
	"purpose" text,
	"copies" integer DEFAULT 1 NOT NULL,
	"status" "document_request_status" DEFAULT 'requested' NOT NULL,
	"fee_amount" numeric(12, 2),
	"payment_id" uuid,
	"document_number" text,
	"remarks" text,
	"rejected_reason" text,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"processed_by" uuid,
	"processed_at" timestamp,
	"released_by" uuid,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "status" "student_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "archived_by" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "archive_reason" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "archived_school_year_id" uuid;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doc_requests_student_idx" ON "document_requests" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "doc_requests_status_idx" ON "document_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "doc_requests_school_year_idx" ON "document_requests" USING btree ("school_year_id");--> statement-breakpoint
CREATE INDEX "doc_requests_requested_at_idx" ON "document_requests" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "doc_requests_pending_idx" ON "document_requests" USING btree ("status") WHERE "document_requests"."status" IN ('requested', 'processing', 'ready') AND "document_requests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "doc_requests_doc_number_uidx" ON "document_requests" USING btree ("document_number") WHERE "document_requests"."document_number" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_archived_school_year_id_school_years_id_fk" FOREIGN KEY ("archived_school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "students_status_idx" ON "students" USING btree ("status");