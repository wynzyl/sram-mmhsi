-- Migration: Add Subject Offering Module
-- Description: Implements the subject offering layer between curriculum and grading
-- Tables: strands, subject_strands, subject_offerings, student_subject_enrollments
-- Modifications: enrollments.strand_id, grade_sheet_entries.student_subject_enrollment_id

-- ─── Enum ─────────────────────────────────────────────────────────────────────

-- SHS academic strand codes
DO $$ BEGIN
    CREATE TYPE "strand_code" AS ENUM(
        'STEM',
        'ABM',
        'HUMSS',
        'GAS',
        'TVL-ICT',
        'TVL-HE',
        'TVL-IA',
        'TVL-AFA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─── New Tables ───────────────────────────────────────────────────────────────

-- Strands table: SHS academic tracks
CREATE TABLE IF NOT EXISTS "strands" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "code" "strand_code" NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "created_by" uuid,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "updated_by" uuid,
    "deleted_at" timestamp,
    "deleted_by" uuid,
    CONSTRAINT "strands_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "strands_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "strands_deleted_by_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Subject-Strand associations
CREATE TABLE IF NOT EXISTS "subject_strands" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "subject_id" uuid NOT NULL,
    "strand_id" uuid NOT NULL,
    "is_strand_core" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "created_by" uuid,
    "deleted_at" timestamp,
    "deleted_by" uuid,
    CONSTRAINT "subject_strands_subject_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE,
    CONSTRAINT "subject_strands_strand_fk" FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE CASCADE,
    CONSTRAINT "subject_strands_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "subject_strands_deleted_by_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Subject offerings: operational layer for section+subject+school_year
CREATE TABLE IF NOT EXISTS "subject_offerings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "section_id" uuid NOT NULL,
    "subject_id" uuid NOT NULL,
    "school_year_id" uuid NOT NULL,
    "teacher_id" uuid,
    "strand_id" uuid,
    "is_active" boolean DEFAULT true NOT NULL,
    "sequence_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "created_by" uuid,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "updated_by" uuid,
    "deleted_at" timestamp,
    "deleted_by" uuid,
    CONSTRAINT "subject_offerings_section_fk" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT,
    CONSTRAINT "subject_offerings_subject_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT,
    CONSTRAINT "subject_offerings_school_year_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT,
    CONSTRAINT "subject_offerings_teacher_fk" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "subject_offerings_strand_fk" FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE SET NULL,
    CONSTRAINT "subject_offerings_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "subject_offerings_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "subject_offerings_deleted_by_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Student subject enrollments: explicit link between students and subject offerings
CREATE TABLE IF NOT EXISTS "student_subject_enrollments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "enrollment_id" uuid NOT NULL,
    "subject_offering_id" uuid NOT NULL,
    "student_id" uuid NOT NULL,
    "school_year_id" uuid NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "withdrawn_at" timestamp,
    "withdrawn_by" uuid,
    "withdrawal_reason" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "created_by" uuid,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "updated_by" uuid,
    "deleted_at" timestamp,
    "deleted_by" uuid,
    CONSTRAINT "sse_enrollment_fk" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT,
    CONSTRAINT "sse_offering_fk" FOREIGN KEY ("subject_offering_id") REFERENCES "subject_offerings"("id") ON DELETE RESTRICT,
    CONSTRAINT "sse_student_fk" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT,
    CONSTRAINT "sse_school_year_fk" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT,
    CONSTRAINT "sse_withdrawn_by_fk" FOREIGN KEY ("withdrawn_by") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "sse_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "sse_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "sse_deleted_by_fk" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL
);

-- ─── Column Modifications ─────────────────────────────────────────────────────

-- Add strand_id to enrollments (for SHS students)
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "strand_id" uuid;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_strand_fk"
    FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE SET NULL;

-- Add student_subject_enrollment_id to grade_sheet_entries (for traceability)
ALTER TABLE "grade_sheet_entries" ADD COLUMN IF NOT EXISTS "student_subject_enrollment_id" uuid;
ALTER TABLE "grade_sheet_entries" ADD CONSTRAINT "gse_sse_fk"
    FOREIGN KEY ("student_subject_enrollment_id") REFERENCES "student_subject_enrollments"("id") ON DELETE SET NULL;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Strands indexes
CREATE UNIQUE INDEX IF NOT EXISTS "strands_code_uidx"
    ON "strands" ("code") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "strands_active_idx"
    ON "strands" ("is_active") WHERE "is_active" = true AND "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "strands_display_order_idx" ON "strands" ("display_order");

-- Subject-Strand indexes
CREATE UNIQUE INDEX IF NOT EXISTS "subject_strands_subject_strand_uidx"
    ON "subject_strands" ("subject_id", "strand_id") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "subject_strands_subject_idx" ON "subject_strands" ("subject_id");
CREATE INDEX IF NOT EXISTS "subject_strands_strand_idx" ON "subject_strands" ("strand_id");

-- Subject Offerings indexes
CREATE UNIQUE INDEX IF NOT EXISTS "subject_offerings_section_subject_sy_uidx"
    ON "subject_offerings" ("section_id", "subject_id", "school_year_id") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "subject_offerings_section_idx" ON "subject_offerings" ("section_id");
CREATE INDEX IF NOT EXISTS "subject_offerings_subject_idx" ON "subject_offerings" ("subject_id");
CREATE INDEX IF NOT EXISTS "subject_offerings_teacher_idx" ON "subject_offerings" ("teacher_id");
CREATE INDEX IF NOT EXISTS "subject_offerings_strand_idx" ON "subject_offerings" ("strand_id");
CREATE INDEX IF NOT EXISTS "subject_offerings_sy_idx" ON "subject_offerings" ("school_year_id");
CREATE INDEX IF NOT EXISTS "subject_offerings_section_active_idx"
    ON "subject_offerings" ("section_id") WHERE "is_active" = true AND "deleted_at" IS NULL;

-- Student Subject Enrollments indexes
CREATE UNIQUE INDEX IF NOT EXISTS "sse_enrollment_offering_uidx"
    ON "student_subject_enrollments" ("enrollment_id", "subject_offering_id")
    WHERE "is_active" = true AND "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "sse_enrollment_idx" ON "student_subject_enrollments" ("enrollment_id");
CREATE INDEX IF NOT EXISTS "sse_offering_idx" ON "student_subject_enrollments" ("subject_offering_id");
CREATE INDEX IF NOT EXISTS "sse_student_idx" ON "student_subject_enrollments" ("student_id");
CREATE INDEX IF NOT EXISTS "sse_school_year_idx" ON "student_subject_enrollments" ("school_year_id");
CREATE INDEX IF NOT EXISTS "sse_student_active_idx"
    ON "student_subject_enrollments" ("student_id") WHERE "is_active" = true AND "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "sse_sy_active_idx"
    ON "student_subject_enrollments" ("school_year_id") WHERE "is_active" = true AND "deleted_at" IS NULL;

-- Grade Sheet Entries index for SSE
CREATE INDEX IF NOT EXISTS "grade_sheet_entries_sse_idx"
    ON "grade_sheet_entries" ("student_subject_enrollment_id");

-- Enrollments strand index
CREATE INDEX IF NOT EXISTS "enrollments_strand_idx" ON "enrollments" ("strand_id");

-- ─── Seed Default Strands ─────────────────────────────────────────────────────

-- Insert default SHS strands (idempotent - check if exists first)
INSERT INTO "strands" ("code", "name", "description", "display_order", "is_active")
SELECT 'STEM', 'Science, Technology, Engineering, and Mathematics',
       'Academic track focusing on advanced mathematics, science, and technology', 1, true
WHERE NOT EXISTS (SELECT 1 FROM "strands" WHERE "code" = 'STEM' AND "deleted_at" IS NULL);

INSERT INTO "strands" ("code", "name", "description", "display_order", "is_active")
SELECT 'ABM', 'Accountancy, Business, and Management',
       'Academic track focusing on business, finance, and entrepreneurship', 2, true
WHERE NOT EXISTS (SELECT 1 FROM "strands" WHERE "code" = 'ABM' AND "deleted_at" IS NULL);

INSERT INTO "strands" ("code", "name", "description", "display_order", "is_active")
SELECT 'HUMSS', 'Humanities and Social Sciences',
       'Academic track focusing on liberal arts, social sciences, and communication', 3, true
WHERE NOT EXISTS (SELECT 1 FROM "strands" WHERE "code" = 'HUMSS' AND "deleted_at" IS NULL);

INSERT INTO "strands" ("code", "name", "description", "display_order", "is_active")
SELECT 'GAS', 'General Academic Strand',
       'Academic track providing broad foundation across disciplines', 4, true
WHERE NOT EXISTS (SELECT 1 FROM "strands" WHERE "code" = 'GAS' AND "deleted_at" IS NULL);

INSERT INTO "strands" ("code", "name", "description", "display_order", "is_active")
SELECT 'TVL-ICT', 'TVL - Information and Communications Technology',
       'Technical-vocational track focusing on computer systems and technology', 5, true
WHERE NOT EXISTS (SELECT 1 FROM "strands" WHERE "code" = 'TVL-ICT' AND "deleted_at" IS NULL);

INSERT INTO "strands" ("code", "name", "description", "display_order", "is_active")
SELECT 'TVL-HE', 'TVL - Home Economics',
       'Technical-vocational track focusing on hospitality and domestic skills', 6, true
WHERE NOT EXISTS (SELECT 1 FROM "strands" WHERE "code" = 'TVL-HE' AND "deleted_at" IS NULL);

INSERT INTO "strands" ("code", "name", "description", "display_order", "is_active")
SELECT 'TVL-IA', 'TVL - Industrial Arts',
       'Technical-vocational track focusing on industrial and construction trades', 7, true
WHERE NOT EXISTS (SELECT 1 FROM "strands" WHERE "code" = 'TVL-IA' AND "deleted_at" IS NULL);

INSERT INTO "strands" ("code", "name", "description", "display_order", "is_active")
SELECT 'TVL-AFA', 'TVL - Agri-Fishery Arts',
       'Technical-vocational track focusing on agriculture and fisheries', 8, true
WHERE NOT EXISTS (SELECT 1 FROM "strands" WHERE "code" = 'TVL-AFA' AND "deleted_at" IS NULL);
