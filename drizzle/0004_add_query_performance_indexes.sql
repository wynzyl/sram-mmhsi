CREATE INDEX "assessments_sy_billing_idx" ON "assessments" USING btree ("school_year_id","billing_status");--> statement-breakpoint
CREATE INDEX "discount_requests_type_idx" ON "discount_requests" USING btree ("discount_type_id");--> statement-breakpoint
CREATE INDEX "payments_posted_date_idx" ON "payments" USING btree ("payment_date") WHERE "payments"."status" = 'posted';--> statement-breakpoint
CREATE INDEX "ta_section_sy_idx" ON "teacher_assignments" USING btree ("section_id","school_year_id");--> statement-breakpoint
CREATE INDEX "ta_school_year_idx" ON "teacher_assignments" USING btree ("school_year_id");