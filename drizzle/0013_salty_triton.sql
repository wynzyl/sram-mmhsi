ALTER TABLE "registrations" ADD COLUMN "student_type" "enrollment_student_type" DEFAULT 'new_student' NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "intake_documents" jsonb;