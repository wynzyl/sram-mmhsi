ALTER TABLE "sections" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sections_name_grade_sy_uidx" ON "sections" USING btree ("name","grade_level_id","school_year_id") WHERE "sections"."deleted_at" IS NULL;