ALTER TYPE "public"."fee_assessment_band" ADD VALUE 'advance_casa' BEFORE 'lower_elementary';--> statement-breakpoint
ALTER TABLE "assessment_items" DROP CONSTRAINT "assessment_items_assessment_id_assessments_id_fk";
--> statement-breakpoint
ALTER TABLE "fee_schedule_items" DROP CONSTRAINT "fee_schedule_items_fee_schedule_id_fee_schedules_id_fk";
--> statement-breakpoint
ALTER TABLE "fee_schedule_overrides" DROP CONSTRAINT "fee_schedule_overrides_schedule_id_school_year_fee_schedules_id_fk";
--> statement-breakpoint
ALTER TABLE "fee_template_items" DROP CONSTRAINT "fee_template_items_fee_template_id_fee_templates_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_allocations" DROP CONSTRAINT "payment_allocations_payment_id_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "school_year_fee_schedules" DROP CONSTRAINT "school_year_fee_schedules_school_year_id_school_years_id_fk";
--> statement-breakpoint
ALTER TABLE "parents_guardians" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "parents_guardians" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule_items" ADD CONSTRAINT "fee_schedule_items_fee_schedule_id_fee_schedules_id_fk" FOREIGN KEY ("fee_schedule_id") REFERENCES "public"."fee_schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule_overrides" ADD CONSTRAINT "fee_schedule_overrides_schedule_id_school_year_fee_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."school_year_fee_schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_template_items" ADD CONSTRAINT "fee_template_items_fee_template_id_fee_templates_id_fk" FOREIGN KEY ("fee_template_id") REFERENCES "public"."fee_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents_guardians" ADD CONSTRAINT "parents_guardians_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_fee_schedules" ADD CONSTRAINT "school_year_fee_schedules_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pg_deleted_at_idx" ON "parents_guardians" USING btree ("deleted_at") WHERE "parents_guardians"."deleted_at" IS NULL;