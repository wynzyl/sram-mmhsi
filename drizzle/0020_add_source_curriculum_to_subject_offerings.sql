-- Migration: Add source_curriculum_id to subject_offerings
-- Purpose: Track manual subject offerings from curriculums other than the adopted one
-- This enables SHS elective flexibility without changing curriculum adoption

ALTER TABLE "subject_offerings"
ADD COLUMN "source_curriculum_id" UUID REFERENCES "curriculums"("id");

-- Add index for queries filtering by source curriculum
CREATE INDEX "subject_offerings_source_curriculum_idx"
ON "subject_offerings" ("source_curriculum_id");

COMMENT ON COLUMN "subject_offerings"."source_curriculum_id" IS
'Source curriculum for manually added offerings. NULL = from adopted curriculum.';
