-- Apply Fee Templates Schema Changes
-- This creates the new tables and modifies existing ones

BEGIN;

-- Create enum
CREATE TYPE "public"."fee_item_type_category" AS ENUM('tuition', 'fees', 'materials', 'discount', 'other');

-- Create new tables
CREATE TABLE "fee_item_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "fee_item_type_category" NOT NULL,
	"is_discount" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "fee_item_types_code_unique" UNIQUE("code")
);

CREATE TABLE "fee_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"assessment_band" "fee_assessment_band" NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);

CREATE TABLE "fee_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_template_id" uuid NOT NULL,
	"fee_item_type_id" uuid NOT NULL,
	"default_amount" numeric(12, 2) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);

CREATE TABLE "school_year_fee_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"assessment_band" "fee_assessment_band" NOT NULL,
	"fee_template_id" uuid NOT NULL,
	"effective_date" timestamp NOT NULL,
	"expiry_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "syfs_dates_chk" CHECK ("school_year_fee_schedules"."expiry_date" IS NULL OR "school_year_fee_schedules"."expiry_date" > "school_year_fee_schedules"."effective_date")
);

CREATE TABLE "fee_schedule_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"fee_template_item_id" uuid NOT NULL,
	"override_amount" numeric(12, 2) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);

-- Add columns to assessment_items
ALTER TABLE "assessment_items" ADD COLUMN IF NOT EXISTS "fee_template_item_id" uuid;
ALTER TABLE "assessment_items" ADD COLUMN IF NOT EXISTS "fee_item_type_id" uuid;

-- Add foreign keys
ALTER TABLE "fee_item_types" ADD CONSTRAINT "fee_item_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "fee_item_types" ADD CONSTRAINT "fee_item_types_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "fee_templates" ADD CONSTRAINT "fee_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "fee_templates" ADD CONSTRAINT "fee_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "fee_template_items" ADD CONSTRAINT "fee_template_items_fee_template_id_fee_templates_id_fk" FOREIGN KEY ("fee_template_id") REFERENCES "public"."fee_templates"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "fee_template_items" ADD CONSTRAINT "fee_template_items_fee_item_type_id_fee_item_types_id_fk" FOREIGN KEY ("fee_item_type_id") REFERENCES "public"."fee_item_types"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "fee_template_items" ADD CONSTRAINT "fee_template_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "fee_template_items" ADD CONSTRAINT "fee_template_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "school_year_fee_schedules" ADD CONSTRAINT "school_year_fee_schedules_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "school_year_fee_schedules" ADD CONSTRAINT "school_year_fee_schedules_fee_template_id_fee_templates_id_fk" FOREIGN KEY ("fee_template_id") REFERENCES "public"."fee_templates"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "school_year_fee_schedules" ADD CONSTRAINT "school_year_fee_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "school_year_fee_schedules" ADD CONSTRAINT "school_year_fee_schedules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "fee_schedule_overrides" ADD CONSTRAINT "fee_schedule_overrides_schedule_id_school_year_fee_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."school_year_fee_schedules"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "fee_schedule_overrides" ADD CONSTRAINT "fee_schedule_overrides_fee_template_item_id_fee_template_items_id_fk" FOREIGN KEY ("fee_template_item_id") REFERENCES "public"."fee_template_items"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "fee_schedule_overrides" ADD CONSTRAINT "fee_schedule_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "fee_schedule_overrides" ADD CONSTRAINT "fee_schedule_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_fee_template_item_id_fee_template_items_id_fk" FOREIGN KEY ("fee_template_item_id") REFERENCES "public"."fee_template_items"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_fee_item_type_id_fee_item_types_id_fk" FOREIGN KEY ("fee_item_type_id") REFERENCES "public"."fee_item_types"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes
CREATE UNIQUE INDEX "fee_item_types_code_uidx" ON "fee_item_types" USING btree ("code");
CREATE INDEX "fee_item_types_category_idx" ON "fee_item_types" USING btree ("category");
CREATE INDEX "fee_item_types_active_idx" ON "fee_item_types" USING btree ("is_active") WHERE "fee_item_types"."is_active" = true;

CREATE INDEX "fee_templates_band_idx" ON "fee_templates" USING btree ("assessment_band");
CREATE INDEX "fee_templates_active_idx" ON "fee_templates" USING btree ("is_active") WHERE "fee_templates"."is_active" = true;

CREATE INDEX "fee_template_items_template_idx" ON "fee_template_items" USING btree ("fee_template_id");
CREATE INDEX "fee_template_items_type_idx" ON "fee_template_items" USING btree ("fee_item_type_id");
CREATE UNIQUE INDEX "fee_template_items_template_type_uidx" ON "fee_template_items" USING btree ("fee_template_id", "fee_item_type_id");

CREATE UNIQUE INDEX "syfs_sy_band_active_uidx" ON "school_year_fee_schedules" USING btree ("school_year_id", "assessment_band") WHERE "school_year_fee_schedules"."is_active" = true;
CREATE INDEX "syfs_sy_band_idx" ON "school_year_fee_schedules" USING btree ("school_year_id", "assessment_band");
CREATE INDEX "syfs_effective_idx" ON "school_year_fee_schedules" USING btree ("effective_date");

CREATE UNIQUE INDEX "fso_schedule_item_uidx" ON "fee_schedule_overrides" USING btree ("schedule_id", "fee_template_item_id");
CREATE INDEX "fso_schedule_idx" ON "fee_schedule_overrides" USING btree ("schedule_id");

CREATE INDEX "ai_fee_item_type_idx" ON "assessment_items" USING btree ("fee_item_type_id");
CREATE INDEX "ai_fee_template_item_idx" ON "assessment_items" USING btree ("fee_template_item_id");

COMMIT;
