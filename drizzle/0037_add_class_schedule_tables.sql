-- Migration: Add class schedule tables (periods, rooms, schedule_slots)
-- Feature: Class scheduling with conflict detection for sections, teachers, and rooms

-- Create day_of_week enum
CREATE TYPE "public"."day_of_week" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday');

-- Create room_type enum
CREATE TYPE "public"."room_type" AS ENUM('classroom', 'laboratory', 'computer_lab', 'library', 'gymnasium', 'auditorium', 'other');

-- Create periods table (period templates per school year)
CREATE TABLE IF NOT EXISTS "periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"period_number" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"is_class_period" boolean DEFAULT true NOT NULL,
	"assessment_band" "fee_assessment_band",
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	CONSTRAINT "periods_time_check" CHECK ("end_time" > "start_time")
);
--> statement-breakpoint

-- Create rooms table
CREATE TABLE IF NOT EXISTS "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"building" text,
	"floor" text,
	"capacity" integer,
	"room_type" "room_type" DEFAULT 'classroom' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint

-- Create schedule_slots table
CREATE TABLE IF NOT EXISTS "schedule_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_offering_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"period_id" uuid NOT NULL,
	"room_id" uuid,
	"school_year_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"teacher_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint

-- Add foreign key constraints for periods
ALTER TABLE "periods" ADD CONSTRAINT "periods_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "periods" ADD CONSTRAINT "periods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "periods" ADD CONSTRAINT "periods_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "periods" ADD CONSTRAINT "periods_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Add foreign key constraints for rooms
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Add foreign key constraints for schedule_slots
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_subject_offering_id_subject_offerings_id_fk" FOREIGN KEY ("subject_offering_id") REFERENCES "public"."subject_offerings"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Periods indexes
CREATE UNIQUE INDEX IF NOT EXISTS "periods_sy_num_band_uidx" ON "periods" USING btree ("school_year_id","period_number","assessment_band") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "periods_sy_idx" ON "periods" USING btree ("school_year_id");
CREATE INDEX IF NOT EXISTS "periods_active_idx" ON "periods" USING btree ("school_year_id") WHERE "is_active" = true AND "deleted_at" IS NULL;
--> statement-breakpoint

-- Rooms indexes
CREATE UNIQUE INDEX IF NOT EXISTS "rooms_code_uidx" ON "rooms" USING btree ("code") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "rooms_type_idx" ON "rooms" USING btree ("room_type");
CREATE INDEX IF NOT EXISTS "rooms_active_idx" ON "rooms" USING btree ("id") WHERE "is_active" = true AND "deleted_at" IS NULL;
--> statement-breakpoint

-- Schedule slots indexes (including conflict detection unique indexes)
-- Section conflict: A section can only be in one place at a time
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_slots_section_conflict_uidx" ON "schedule_slots" USING btree ("section_id","day_of_week","period_id","school_year_id") WHERE "deleted_at" IS NULL;
-- Teacher conflict: A teacher can only teach one class at a time
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_slots_teacher_conflict_uidx" ON "schedule_slots" USING btree ("teacher_id","day_of_week","period_id","school_year_id") WHERE "teacher_id" IS NOT NULL AND "deleted_at" IS NULL;
-- Room conflict: A room can only host one class at a time
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_slots_room_conflict_uidx" ON "schedule_slots" USING btree ("room_id","day_of_week","period_id","school_year_id") WHERE "room_id" IS NOT NULL AND "deleted_at" IS NULL;
-- Performance indexes
CREATE INDEX IF NOT EXISTS "schedule_slots_offering_idx" ON "schedule_slots" USING btree ("subject_offering_id");
CREATE INDEX IF NOT EXISTS "schedule_slots_period_idx" ON "schedule_slots" USING btree ("period_id");
CREATE INDEX IF NOT EXISTS "schedule_slots_room_idx" ON "schedule_slots" USING btree ("room_id");
CREATE INDEX IF NOT EXISTS "schedule_slots_sy_idx" ON "schedule_slots" USING btree ("school_year_id");
CREATE INDEX IF NOT EXISTS "schedule_slots_section_sy_idx" ON "schedule_slots" USING btree ("section_id","school_year_id") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "schedule_slots_teacher_sy_idx" ON "schedule_slots" USING btree ("teacher_id","school_year_id") WHERE "teacher_id" IS NOT NULL AND "deleted_at" IS NULL;
