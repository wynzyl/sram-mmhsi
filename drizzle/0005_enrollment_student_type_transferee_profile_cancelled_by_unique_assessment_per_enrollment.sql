CREATE TYPE "public"."enrollment_student_type" AS ENUM('new_student', 'transferee', 'old_student');--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "student_type" "enrollment_student_type" DEFAULT 'new_student' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "previous_school" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "submitted_documents_notes" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_enrollment_id_uidx" ON "assessments" USING btree ("enrollment_id");
