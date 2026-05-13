CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "fso_template_item_idx" ON "fee_schedule_overrides" USING btree ("fee_template_item_id");--> statement-breakpoint
CREATE INDEX "pg_email_idx" ON "parents_guardians" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");