ALTER TABLE "assessments" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;