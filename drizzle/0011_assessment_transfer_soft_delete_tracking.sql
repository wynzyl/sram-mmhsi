ALTER TABLE "assessment_items" ADD COLUMN "source_assessment_id" uuid;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "transferred_at" timestamp;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "transferred_by" uuid;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "transferred_to_assessment_id" uuid;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "transfer_remarks" text;--> statement-breakpoint
ALTER TABLE "fee_templates" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "fee_templates" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "student_guardian_links" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "student_guardian_links" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_source_assessment_id_assessments_id_fk" FOREIGN KEY ("source_assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_transferred_by_users_id_fk" FOREIGN KEY ("transferred_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_transferred_to_assessment_id_assessments_id_fk" FOREIGN KEY ("transferred_to_assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_templates" ADD CONSTRAINT "fee_templates_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardian_links" ADD CONSTRAINT "student_guardian_links_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_source_assessment_idx" ON "assessment_items" USING btree ("source_assessment_id");--> statement-breakpoint
CREATE INDEX "assessments_transferred_at_idx" ON "assessments" USING btree ("transferred_at");