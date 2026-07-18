DROP INDEX "curriculum_adoptions_sy_grade_uidx";--> statement-breakpoint
ALTER TABLE "curriculum_adoptions" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "curriculum_adoptions" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "curriculum_adoptions" ADD CONSTRAINT "curriculum_adoptions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "curriculum_adoptions_sy_grade_uidx" ON "curriculum_adoptions" USING btree ("school_year_id","grade_level_id") WHERE "curriculum_adoptions"."deleted_at" IS NULL;