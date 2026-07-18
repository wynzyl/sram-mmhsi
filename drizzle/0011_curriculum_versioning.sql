-- Migration: curriculum_versioning
-- Transforms curriculums table from simple structure to versioned, immutable system
-- with adoption bindings per school year + grade level.

-- Step 1: Create the curriculum_status enum
CREATE TYPE "public"."curriculum_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint

-- Step 2: Create curriculum_adoptions table (decouples curriculum from school year)
CREATE TABLE "curriculum_adoptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"curriculum_id" uuid NOT NULL,
	"adopted_at" timestamp DEFAULT now() NOT NULL,
	"adopted_by" uuid NOT NULL
);
--> statement-breakpoint

-- Step 3: Alter curriculums table - add new columns
ALTER TABLE "curriculums" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "curriculums" ADD COLUMN "status" "curriculum_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculums" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculums" ADD COLUMN "root_id" uuid;--> statement-breakpoint
ALTER TABLE "curriculums" ADD COLUMN "predecessor_id" uuid;--> statement-breakpoint
ALTER TABLE "curriculums" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "curriculums" ADD COLUMN "published_by" uuid;--> statement-breakpoint
ALTER TABLE "curriculums" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "curriculums" ADD COLUMN "archived_by" uuid;--> statement-breakpoint
ALTER TABLE "curriculums" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculums" ADD COLUMN "updated_by" uuid;--> statement-breakpoint

-- Step 4: Backfill existing curriculums
-- Mark all existing curriculums as published (they're already in use)
-- Set rootId = id (they are v1 of their own chain)
UPDATE "curriculums"
SET
  "status" = 'published',
  "root_id" = "id",
  "published_at" = "created_at";
--> statement-breakpoint

-- Step 5: Create curriculum_adoptions from existing data
-- For each curriculum, create adoptions based on effectiveSchoolYearId and the grade levels
-- from its subjects. Use a system user (first super_admin) as adoptedBy.
INSERT INTO "curriculum_adoptions" ("id", "school_year_id", "grade_level_id", "curriculum_id", "adopted_at", "adopted_by")
SELECT
  gen_random_uuid(),
  c.effective_school_year_id,
  s.grade_level_id,
  c.id,
  c.created_at,
  COALESCE(c.created_by, (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1))
FROM curriculums c
JOIN (
  SELECT DISTINCT curriculum_id, grade_level_id
  FROM subjects
  WHERE grade_level_id IS NOT NULL AND deleted_at IS NULL
) s ON s.curriculum_id = c.id
WHERE c.effective_school_year_id IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Step 6: Make effectiveSchoolYearId nullable (it's now deprecated, adoptions table is source of truth)
ALTER TABLE "curriculums" ALTER COLUMN "effective_school_year_id" DROP NOT NULL;--> statement-breakpoint

-- Step 7: Add new columns to subjects table
ALTER TABLE "subjects" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "units" numeric(4, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "sequence_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "is_core" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "grading_weight" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "updated_by" uuid;--> statement-breakpoint

-- Step 8: Add foreign key constraints for curriculum_adoptions
ALTER TABLE "curriculum_adoptions" ADD CONSTRAINT "curriculum_adoptions_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_adoptions" ADD CONSTRAINT "curriculum_adoptions_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_adoptions" ADD CONSTRAINT "curriculum_adoptions_curriculum_id_curriculums_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."curriculums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_adoptions" ADD CONSTRAINT "curriculum_adoptions_adopted_by_users_id_fk" FOREIGN KEY ("adopted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Step 9: Add indexes for curriculum_adoptions
CREATE UNIQUE INDEX "curriculum_adoptions_sy_grade_uidx" ON "curriculum_adoptions" USING btree ("school_year_id","grade_level_id");--> statement-breakpoint
CREATE INDEX "curriculum_adoptions_curriculum_idx" ON "curriculum_adoptions" USING btree ("curriculum_id");--> statement-breakpoint
CREATE INDEX "curriculum_adoptions_sy_idx" ON "curriculum_adoptions" USING btree ("school_year_id");--> statement-breakpoint

-- Step 10: Add foreign key constraints for curriculums (new columns)
ALTER TABLE "curriculums" ADD CONSTRAINT "curriculums_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculums" ADD CONSTRAINT "curriculums_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculums" ADD CONSTRAINT "curriculums_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Step 11: Self-referencing foreign keys for version chain
ALTER TABLE "curriculums" ADD CONSTRAINT "curriculums_root_id_curriculums_id_fk" FOREIGN KEY ("root_id") REFERENCES "public"."curriculums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculums" ADD CONSTRAINT "curriculums_predecessor_id_curriculums_id_fk" FOREIGN KEY ("predecessor_id") REFERENCES "public"."curriculums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Step 12: Add foreign key constraint for subjects (new column)
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Step 13: Add indexes for curriculums (new columns)
CREATE INDEX "curriculums_status_idx" ON "curriculums" USING btree ("status");--> statement-breakpoint
CREATE INDEX "curriculums_root_idx" ON "curriculums" USING btree ("root_id");--> statement-breakpoint
CREATE UNIQUE INDEX "curriculums_pred_draft_uidx" ON "curriculums" USING btree ("predecessor_id") WHERE "curriculums"."status" = 'draft' AND "curriculums"."predecessor_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "curriculums_name_status_uidx" ON "curriculums" USING btree ("name","status") WHERE "curriculums"."status" = 'draft';--> statement-breakpoint

-- Step 14: Add indexes for subjects (new columns)
CREATE INDEX "subjects_curriculum_grade_idx" ON "subjects" USING btree ("curriculum_id","grade_level_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_curriculum_code_uidx" ON "subjects" USING btree ("curriculum_id","code") WHERE "subjects"."deleted_at" IS NULL;
