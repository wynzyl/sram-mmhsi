ALTER TABLE "enrollment_cancellation_requests" DROP CONSTRAINT "enrollment_cancellation_requests_enrollment_id_enrollments_id_fk";
--> statement-breakpoint
ALTER TABLE "enrollment_cancellation_requests" ADD CONSTRAINT "enrollment_cancellation_requests_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;