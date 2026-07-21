-- Add missing grading_period_systems table from partially applied migration 0015
-- Using IF NOT EXISTS to make this idempotent

-- Create grading system type enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grading_system_type') THEN
        CREATE TYPE "public"."grading_system_type" AS ENUM('quarterly', 'trimester');
    END IF;
END
$$;

-- Create grading_period_systems table if not exists
CREATE TABLE IF NOT EXISTS "grading_period_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"system_type" "grading_system_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);

-- Add foreign keys (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grading_period_systems_school_year_id_school_years_id_fk') THEN
        ALTER TABLE "grading_period_systems" ADD CONSTRAINT "grading_period_systems_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grading_period_systems_created_by_users_id_fk') THEN
        ALTER TABLE "grading_period_systems" ADD CONSTRAINT "grading_period_systems_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grading_period_systems_updated_by_users_id_fk') THEN
        ALTER TABLE "grading_period_systems" ADD CONSTRAINT "grading_period_systems_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END
$$;

-- Create unique index (only if it doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "grading_period_systems_sy_uidx" ON "grading_period_systems" USING btree ("school_year_id");
