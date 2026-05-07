ALTER TYPE "public"."role" ADD VALUE 'super_admin' BEFORE 'admin';--> statement-breakpoint

-- Ensure soft-deleted teacher assignments do not participate in uniqueness checks.
DROP INDEX IF EXISTS "ta_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "ta_unique_idx" ON "teacher_assignments" USING btree ("teacher_id","subject_id","section_id","school_year_id") WHERE "teacher_assignments"."deleted_at" is null;--> statement-breakpoint