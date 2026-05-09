CREATE INDEX "ai_assessment_idx" ON "assessment_items" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "gr_teacher_assignment_idx" ON "grade_records" USING btree ("teacher_assignment_id");--> statement-breakpoint
CREATE INDEX "pa_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "subjects_curriculum_idx" ON "subjects" USING btree ("curriculum_id");--> statement-breakpoint
CREATE INDEX "subjects_active_idx" ON "subjects" USING btree ("id") WHERE "subjects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ta_subject_idx" ON "teacher_assignments" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "ta_active_idx" ON "teacher_assignments" USING btree ("teacher_id") WHERE "teacher_assignments"."deleted_at" IS NULL;