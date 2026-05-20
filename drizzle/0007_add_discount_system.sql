CREATE TYPE "public"."discount_base_type" AS ENUM('tuition_only', 'full_assessment');--> statement-breakpoint
CREATE TYPE "public"."discount_calculation_type" AS ENUM('fixed_amount', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."discount_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "discount_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"assessment_id" uuid,
	"discount_type_id" uuid NOT NULL,
	"request_reason" text,
	"base_amount" numeric(12, 2),
	"calculated_amount" numeric(12, 2),
	"override_value" numeric(12, 2),
	"override_reason" text,
	"status" "discount_request_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp,
	"decision_remarks" text,
	"cancelled_at" timestamp,
	"cancelled_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"calculation_type" "discount_calculation_type" NOT NULL,
	"base_type" "discount_base_type" DEFAULT 'tuition_only' NOT NULL,
	"default_value" numeric(12, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"requires_documentation" boolean DEFAULT true NOT NULL,
	"is_stackable" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "student_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"discount_request_id" uuid NOT NULL,
	"discount_type_code" text NOT NULL,
	"discount_type_name" text NOT NULL,
	"calculation_type" "discount_calculation_type" NOT NULL,
	"base_type" "discount_base_type" NOT NULL,
	"base_amount" numeric(12, 2) NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"assessment_item_id" uuid,
	"reversed_at" timestamp,
	"reversed_by" uuid,
	"reversal_remarks" text,
	"reversal_discount_id" uuid,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"applied_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_items" ADD COLUMN "student_discount_id" uuid;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "total_discounts" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "has_discounts_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_discount_type_id_discount_types_id_fk" FOREIGN KEY ("discount_type_id") REFERENCES "public"."discount_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_types" ADD CONSTRAINT "discount_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_types" ADD CONSTRAINT "discount_types_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_types" ADD CONSTRAINT "discount_types_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_discount_request_id_discount_requests_id_fk" FOREIGN KEY ("discount_request_id") REFERENCES "public"."discount_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_assessment_item_id_assessment_items_id_fk" FOREIGN KEY ("assessment_item_id") REFERENCES "public"."assessment_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discount_requests_enrollment_type_uidx" ON "discount_requests" USING btree ("enrollment_id","discount_type_id") WHERE "discount_requests"."status" IN ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "discount_requests_student_idx" ON "discount_requests" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "discount_requests_enrollment_idx" ON "discount_requests" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "discount_requests_status_idx" ON "discount_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "discount_requests_pending_idx" ON "discount_requests" USING btree ("status") WHERE "discount_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "discount_types_code_uidx" ON "discount_types" USING btree ("code") WHERE "discount_types"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "discount_types_active_idx" ON "discount_types" USING btree ("is_active") WHERE "discount_types"."is_active" = true AND "discount_types"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "discount_types_display_order_idx" ON "discount_types" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "student_discounts_student_idx" ON "student_discounts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_discounts_assessment_idx" ON "student_discounts" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "student_discounts_request_idx" ON "student_discounts" USING btree ("discount_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_discounts_request_active_uidx" ON "student_discounts" USING btree ("discount_request_id") WHERE "student_discounts"."reversed_at" IS NULL;