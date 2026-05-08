CREATE INDEX "enrollment_sy_status_idx" ON "enrollments" USING btree ("school_year_id","status");--> statement-breakpoint
CREATE INDEX "enrollment_student_sy_status_idx" ON "enrollments" USING btree ("student_id","school_year_id","status");--> statement-breakpoint
CREATE INDEX "reg_sy_status_idx" ON "registrations" USING btree ("school_year_id","status");