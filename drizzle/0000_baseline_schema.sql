CREATE TYPE "public"."assessment_billing_status" AS ENUM('outstanding', 'fully_paid', 'cancelled', 'balance_forwarded');--> statement-breakpoint
CREATE TYPE "public"."booklet_status" AS ENUM('active', 'exhausted', 'voided');--> statement-breakpoint
CREATE TYPE "public"."cancellation_reason_type" AS ENUM('transfer', 'financial', 'medical', 'relocation', 'personal', 'administrative', 'non_compliance', 'disciplinary', 'other');--> statement-breakpoint
CREATE TYPE "public"."clearance_status" AS ENUM('cleared', 'pending', 'waived');--> statement-breakpoint
CREATE TYPE "public"."clearance_type" AS ENUM('end_of_year', 'enrollment_cancellation', 'transfer_out', 'graduation', 'other');--> statement-breakpoint
CREATE TYPE "public"."discount_base_type" AS ENUM('tuition_only', 'full_assessment');--> statement-breakpoint
CREATE TYPE "public"."discount_calculation_type" AS ENUM('fixed_amount', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."discount_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."enrollment_cancellation_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('pending', 'assessed', 'enrolled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."enrollment_student_type" AS ENUM('new_student', 'transferee', 'old_student');--> statement-breakpoint
CREATE TYPE "public"."fee_assessment_band" AS ENUM('casa', 'advance_casa', 'lower_elementary', 'higher_elementary', 'junior_high', 'senior_high');--> statement-breakpoint
CREATE TYPE "public"."fee_item_type_category" AS ENUM('tuition', 'fees', 'materials', 'discount', 'other');--> statement-breakpoint
CREATE TYPE "public"."grade_status" AS ENUM('draft', 'submitted', 'locked');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'viewed', 'settled', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."or_status" AS ENUM('available', 'consumed', 'voided');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('payment', 'reversal', 'balance_forward');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending_confirmation', 'posted', 'voided', 'reversed', 'reversal', 'balance_forward');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."resolution_type" AS ENUM('paid', 'waived', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('super_admin', 'admin', 'registrar', 'finance_officer', 'cashier', 'teacher', 'student', 'parent_guardian');--> statement-breakpoint
CREATE TYPE "public"."void_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "assessment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"fee_schedule_item_id" uuid,
	"fee_template_item_id" uuid,
	"fee_item_type_id" uuid,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"is_discount" boolean DEFAULT false NOT NULL,
	"is_refundable" boolean DEFAULT true NOT NULL,
	"source_assessment_id" uuid,
	"student_discount_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"total_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_discounts" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(12, 2) NOT NULL,
	"has_discounts_pending" boolean DEFAULT false NOT NULL,
	"billing_status" "assessment_billing_status" DEFAULT 'outstanding' NOT NULL,
	"remarks" text,
	"cancelled_at" timestamp,
	"cancelled_by" uuid,
	"transferred_at" timestamp,
	"transferred_by" uuid,
	"transferred_to_assessment_id" uuid,
	"transfer_remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "assessments_transfer_fields_atomic" CHECK (
          ((
            "assessments"."transferred_at" IS NULL AND
            "assessments"."transferred_by" IS NULL AND
            "assessments"."transferred_to_assessment_id" IS NULL
          ) OR (
            "assessments"."transferred_by" IS NOT NULL AND
            "assessments"."transferred_to_assessment_id" IS NOT NULL
          )))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"target_entity" text NOT NULL,
	"target_id" text,
	"previous_state" text,
	"new_state" text,
	"context" text,
	"correlation_id" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"effective_school_year_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
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
	"reversed_at" timestamp,
	"reversed_by" uuid,
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
CREATE TABLE "enrollment_cancellation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"reason_type" "cancellation_reason_type" NOT NULL,
	"remarks" text,
	"status" "enrollment_cancellation_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_remarks" text,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"section_id" uuid,
	"registration_id" uuid,
	"student_type" "enrollment_student_type" DEFAULT 'new_student' NOT NULL,
	"intake_documents" jsonb,
	"status" "enrollment_status" DEFAULT 'pending' NOT NULL,
	"enrolled_at" timestamp,
	"cancelled_at" timestamp,
	"cancelled_by" uuid,
	"cancel_remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "fee_item_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "fee_item_type_category" NOT NULL,
	"is_discount" boolean DEFAULT false NOT NULL,
	"is_refundable" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "fee_item_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fee_schedule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_schedule_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"is_discount" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "fee_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"grade_level_id" uuid,
	"assessment_band" "fee_assessment_band",
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "fee_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_template_id" uuid NOT NULL,
	"fee_item_type_id" uuid NOT NULL,
	"default_amount" numeric(12, 2) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "fee_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"assessment_band" "fee_assessment_band" NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "grade_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"assessment_band" "fee_assessment_band" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_assignment_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"grading_period" text NOT NULL,
	"grade" numeric(5, 2),
	"status" "grade_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp,
	"submitted_by" uuid,
	"locked_at" timestamp,
	"locked_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"assessment_id" uuid,
	"invoice_number" text NOT NULL,
	"amount_due" numeric(12, 2) NOT NULL,
	"due_date" timestamp,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp,
	"sent_by" uuid,
	"viewed_at" timestamp,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "parents_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"relationship" text NOT NULL,
	"address" text NOT NULL,
	"occupation" text,
	"contact_number" text NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"assessment_item_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"assessment_id" uuid,
	"booklet_id" uuid,
	"or_number" text,
	"or_status" "or_status" DEFAULT 'consumed' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"reference_number" text,
	"payment_date" timestamp NOT NULL,
	"status" "payment_status" DEFAULT 'pending_confirmation' NOT NULL,
	"remarks" text,
	"idempotency_key" text,
	"voided_at" timestamp,
	"voided_by" uuid,
	"void_reason" text,
	"kind" "payment_kind" DEFAULT 'payment' NOT NULL,
	"reverses_payment_id" uuid,
	"reversed_at" timestamp,
	"reversed_by" uuid,
	"reversed_by_request_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "payments_or_number_required_when_consumed" CHECK (("payments"."or_status" <> 'consumed' OR "payments"."or_number" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "receipt_booklets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series" text NOT NULL,
	"prefix" text NOT NULL,
	"start_number" integer NOT NULL,
	"end_number" integer NOT NULL,
	"next_number" integer NOT NULL,
	"status" "booklet_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"student_type" "enrollment_student_type" DEFAULT 'new_student' NOT NULL,
	"intake_documents" jsonb,
	"status" "registration_status" DEFAULT 'pending' NOT NULL,
	"remarks" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "school_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	CONSTRAINT "school_year_dates_order_chk" CHECK ("school_years"."end_date" > "school_years"."start_date")
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_clearances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"school_year_id" uuid,
	"clearance_type" "clearance_type" NOT NULL,
	"outstanding_amount" numeric(12, 2) NOT NULL,
	"status" "clearance_status" DEFAULT 'pending' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"resolution_type" "resolution_type",
	"resolution_remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
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
	"replaced_by_request_id" uuid,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"applied_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_guardian_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_number" text NOT NULL,
	"lrn" text,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"suffix" text,
	"date_of_birth" timestamp,
	"gender" text,
	"address" text,
	"mobile_number" text,
	"email" text,
	"nationality" text,
	"blood_type" text,
	"religion" text,
	"previous_school" text,
	"submitted_documents_notes" text,
	"user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	CONSTRAINT "students_lrn_unique" UNIQUE("lrn")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"curriculum_id" uuid NOT NULL,
	"grade_level_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "teacher_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"force_password_change" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "void_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"request_reason" text NOT NULL,
	"status" "void_request_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp,
	"decision_remarks" text,
	"cancelled_at" timestamp,
	"reversal_payment_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_fee_schedule_item_id_fee_schedule_items_id_fk" FOREIGN KEY ("fee_schedule_item_id") REFERENCES "public"."fee_schedule_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_fee_template_item_id_fee_template_items_id_fk" FOREIGN KEY ("fee_template_item_id") REFERENCES "public"."fee_template_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_fee_item_type_id_fee_item_types_id_fk" FOREIGN KEY ("fee_item_type_id") REFERENCES "public"."fee_item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_source_assessment_id_assessments_id_fk" FOREIGN KEY ("source_assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_transferred_by_users_id_fk" FOREIGN KEY ("transferred_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_users_id_fk" FOREIGN KEY ("actor") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculums" ADD CONSTRAINT "curriculums_effective_school_year_id_school_years_id_fk" FOREIGN KEY ("effective_school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculums" ADD CONSTRAINT "curriculums_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_discount_type_id_discount_types_id_fk" FOREIGN KEY ("discount_type_id") REFERENCES "public"."discount_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_types" ADD CONSTRAINT "discount_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_types" ADD CONSTRAINT "discount_types_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_types" ADD CONSTRAINT "discount_types_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_cancellation_requests" ADD CONSTRAINT "enrollment_cancellation_requests_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_cancellation_requests" ADD CONSTRAINT "enrollment_cancellation_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_cancellation_requests" ADD CONSTRAINT "enrollment_cancellation_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_cancellation_requests" ADD CONSTRAINT "enrollment_cancellation_requests_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_item_types" ADD CONSTRAINT "fee_item_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_item_types" ADD CONSTRAINT "fee_item_types_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule_items" ADD CONSTRAINT "fee_schedule_items_fee_schedule_id_fee_schedules_id_fk" FOREIGN KEY ("fee_schedule_id") REFERENCES "public"."fee_schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule_items" ADD CONSTRAINT "fee_schedule_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule_items" ADD CONSTRAINT "fee_schedule_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule_overrides" ADD CONSTRAINT "fee_schedule_overrides_schedule_id_school_year_fee_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."school_year_fee_schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule_overrides" ADD CONSTRAINT "fee_schedule_overrides_fee_template_item_id_fee_template_items_id_fk" FOREIGN KEY ("fee_template_item_id") REFERENCES "public"."fee_template_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule_overrides" ADD CONSTRAINT "fee_schedule_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule_overrides" ADD CONSTRAINT "fee_schedule_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_template_items" ADD CONSTRAINT "fee_template_items_fee_template_id_fee_templates_id_fk" FOREIGN KEY ("fee_template_id") REFERENCES "public"."fee_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_template_items" ADD CONSTRAINT "fee_template_items_fee_item_type_id_fee_item_types_id_fk" FOREIGN KEY ("fee_item_type_id") REFERENCES "public"."fee_item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_template_items" ADD CONSTRAINT "fee_template_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_template_items" ADD CONSTRAINT "fee_template_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_template_items" ADD CONSTRAINT "fee_template_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_templates" ADD CONSTRAINT "fee_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_templates" ADD CONSTRAINT "fee_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_templates" ADD CONSTRAINT "fee_templates_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_teacher_assignment_id_teacher_assignments_id_fk" FOREIGN KEY ("teacher_assignment_id") REFERENCES "public"."teacher_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents_guardians" ADD CONSTRAINT "parents_guardians_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents_guardians" ADD CONSTRAINT "parents_guardians_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents_guardians" ADD CONSTRAINT "parents_guardians_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents_guardians" ADD CONSTRAINT "parents_guardians_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_assessment_item_id_assessment_items_id_fk" FOREIGN KEY ("assessment_item_id") REFERENCES "public"."assessment_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booklet_id_receipt_booklets_id_fk" FOREIGN KEY ("booklet_id") REFERENCES "public"."receipt_booklets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reverses_payment_id_payments_id_fk" FOREIGN KEY ("reverses_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_booklets" ADD CONSTRAINT "receipt_booklets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_booklets" ADD CONSTRAINT "receipt_booklets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_fee_schedules" ADD CONSTRAINT "school_year_fee_schedules_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_fee_schedules" ADD CONSTRAINT "school_year_fee_schedules_fee_template_id_fee_templates_id_fk" FOREIGN KEY ("fee_template_id") REFERENCES "public"."fee_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_fee_schedules" ADD CONSTRAINT "school_year_fee_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_fee_schedules" ADD CONSTRAINT "school_year_fee_schedules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_years" ADD CONSTRAINT "school_years_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_years" ADD CONSTRAINT "school_years_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_years" ADD CONSTRAINT "school_years_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_clearances" ADD CONSTRAINT "student_clearances_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_discount_request_id_discount_requests_id_fk" FOREIGN KEY ("discount_request_id") REFERENCES "public"."discount_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_assessment_item_id_assessment_items_id_fk" FOREIGN KEY ("assessment_item_id") REFERENCES "public"."assessment_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_replaced_by_request_id_discount_requests_id_fk" FOREIGN KEY ("replaced_by_request_id") REFERENCES "public"."discount_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardian_links" ADD CONSTRAINT "student_guardian_links_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardian_links" ADD CONSTRAINT "student_guardian_links_guardian_id_parents_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."parents_guardians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardian_links" ADD CONSTRAINT "student_guardian_links_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_curriculum_id_curriculums_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."curriculums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "void_requests" ADD CONSTRAINT "void_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "void_requests" ADD CONSTRAINT "void_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_assessment_idx" ON "assessment_items" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "ai_fee_item_type_idx" ON "assessment_items" USING btree ("fee_item_type_id");--> statement-breakpoint
CREATE INDEX "ai_fee_template_item_idx" ON "assessment_items" USING btree ("fee_template_item_id");--> statement-breakpoint
CREATE INDEX "ai_source_assessment_idx" ON "assessment_items" USING btree ("source_assessment_id");--> statement-breakpoint
CREATE INDEX "ai_student_discount_idx" ON "assessment_items" USING btree ("student_discount_id");--> statement-breakpoint
CREATE INDEX "assessment_student_sy_idx" ON "assessments" USING btree ("student_id","school_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_enrollment_id_uidx" ON "assessments" USING btree ("enrollment_id") WHERE cancelled_at IS NULL;--> statement-breakpoint
CREATE INDEX "assessments_billing_status_idx" ON "assessments" USING btree ("billing_status");--> statement-breakpoint
CREATE INDEX "assessments_student_billing_idx" ON "assessments" USING btree ("student_id","billing_status");--> statement-breakpoint
CREATE INDEX "assessments_transferred_at_idx" ON "assessments" USING btree ("transferred_at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("target_entity","target_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_requests_enrollment_type_uidx" ON "discount_requests" USING btree ("enrollment_id","discount_type_id") WHERE "discount_requests"."status" IN ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "discount_requests_student_idx" ON "discount_requests" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "discount_requests_enrollment_idx" ON "discount_requests" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "discount_requests_status_idx" ON "discount_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "discount_requests_pending_idx" ON "discount_requests" USING btree ("status") WHERE "discount_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "discount_types_code_uidx" ON "discount_types" USING btree ("code") WHERE "discount_types"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "discount_types_active_idx" ON "discount_types" USING btree ("is_active") WHERE "discount_types"."is_active" = true AND "discount_types"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "discount_types_display_order_idx" ON "discount_types" USING btree ("display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "ecr_enrollment_pending_uidx" ON "enrollment_cancellation_requests" USING btree ("enrollment_id") WHERE "enrollment_cancellation_requests"."status" = 'pending' AND "enrollment_cancellation_requests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ecr_enrollment_idx" ON "enrollment_cancellation_requests" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "ecr_status_idx" ON "enrollment_cancellation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ecr_pending_idx" ON "enrollment_cancellation_requests" USING btree ("status","deleted_at") WHERE "enrollment_cancellation_requests"."status" = 'pending' AND "enrollment_cancellation_requests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ecr_requested_by_idx" ON "enrollment_cancellation_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_unique_sy_idx" ON "enrollments" USING btree ("student_id","school_year_id") WHERE status != 'cancelled';--> statement-breakpoint
CREATE INDEX "enrollment_status_idx" ON "enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enrollment_sy_status_idx" ON "enrollments" USING btree ("school_year_id","status");--> statement-breakpoint
CREATE INDEX "enrollment_student_sy_status_idx" ON "enrollments" USING btree ("student_id","school_year_id","status");--> statement-breakpoint
CREATE INDEX "enrollment_sy_status_created_idx" ON "enrollments" USING btree ("school_year_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_item_types_code_uidx" ON "fee_item_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fee_item_types_category_idx" ON "fee_item_types" USING btree ("category");--> statement-breakpoint
CREATE INDEX "fee_item_types_active_idx" ON "fee_item_types" USING btree ("is_active") WHERE "fee_item_types"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "fso_schedule_item_uidx" ON "fee_schedule_overrides" USING btree ("schedule_id","fee_template_item_id");--> statement-breakpoint
CREATE INDEX "fso_schedule_idx" ON "fee_schedule_overrides" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "fso_template_item_idx" ON "fee_schedule_overrides" USING btree ("fee_template_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_schedule_sy_band_uidx" ON "fee_schedules" USING btree ("school_year_id","assessment_band") WHERE "fee_schedules"."assessment_band" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_schedule_sy_legacy_uidx" ON "fee_schedules" USING btree ("school_year_id") WHERE "fee_schedules"."assessment_band" IS NULL;--> statement-breakpoint
CREATE INDEX "fee_template_items_template_idx" ON "fee_template_items" USING btree ("fee_template_id");--> statement-breakpoint
CREATE INDEX "fee_template_items_type_idx" ON "fee_template_items" USING btree ("fee_item_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_template_items_template_type_uidx" ON "fee_template_items" USING btree ("fee_template_id","fee_item_type_id");--> statement-breakpoint
CREATE INDEX "fee_templates_band_idx" ON "fee_templates" USING btree ("assessment_band");--> statement-breakpoint
CREATE INDEX "fee_templates_active_idx" ON "fee_templates" USING btree ("is_active") WHERE "fee_templates"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "gr_unique_idx" ON "grade_records" USING btree ("student_id","teacher_assignment_id","grading_period");--> statement-breakpoint
CREATE INDEX "gr_teacher_assignment_idx" ON "grade_records" USING btree ("teacher_assignment_id");--> statement-breakpoint
CREATE INDEX "gr_student_idx" ON "grade_records" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "gr_status_idx" ON "grade_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "grade_records_teacher_status_period_idx" ON "grade_records" USING btree ("teacher_assignment_id","status","grading_period");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_student_idx" ON "invoices" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pg_name_idx" ON "parents_guardians" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "pg_email_idx" ON "parents_guardians" USING btree ("email");--> statement-breakpoint
CREATE INDEX "pg_deleted_at_idx" ON "parents_guardians" USING btree ("deleted_at") WHERE "parents_guardians"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "pa_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_or_number_idx" ON "payments" USING btree ("or_number") WHERE "payments"."or_number" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_reference_number_unique_idx" ON "payments" USING btree ("reference_number") WHERE "payments"."reference_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_key_uidx" ON "payments" USING btree ("idempotency_key") WHERE "payments"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payments_student_idx" ON "payments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "payments_student_date_idx" ON "payments" USING btree ("student_id","payment_date");--> statement-breakpoint
CREATE INDEX "payments_assessment_status_idx" ON "payments" USING btree ("assessment_id","status");--> statement-breakpoint
CREATE INDEX "payments_reverses_payment_idx" ON "payments" USING btree ("reverses_payment_id");--> statement-breakpoint
CREATE INDEX "payments_kind_idx" ON "payments" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "booklet_status_idx" ON "receipt_booklets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "receipt_booklets_status_active_idx" ON "receipt_booklets" USING btree ("status") WHERE "receipt_booklets"."status" = 'active';--> statement-breakpoint
CREATE INDEX "reg_student_sy_idx" ON "registrations" USING btree ("student_id","school_year_id");--> statement-breakpoint
CREATE INDEX "reg_status_idx" ON "registrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reg_sy_status_idx" ON "registrations" USING btree ("school_year_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "syfs_sy_band_active_uidx" ON "school_year_fee_schedules" USING btree ("school_year_id","assessment_band") WHERE "school_year_fee_schedules"."is_active" = true;--> statement-breakpoint
CREATE INDEX "syfs_sy_band_idx" ON "school_year_fee_schedules" USING btree ("school_year_id","assessment_band");--> statement-breakpoint
CREATE INDEX "syfs_effective_idx" ON "school_year_fee_schedules" USING btree ("effective_date");--> statement-breakpoint
CREATE UNIQUE INDEX "school_year_active_uidx" ON "school_years" USING btree ("is_active") WHERE "school_years"."is_active" = true;--> statement-breakpoint
CREATE INDEX "sections_grade_sy_idx" ON "sections" USING btree ("grade_level_id","school_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "clearances_student_idx" ON "student_clearances" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "clearances_enrollment_idx" ON "student_clearances" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "clearances_school_year_idx" ON "student_clearances" USING btree ("school_year_id");--> statement-breakpoint
CREATE INDEX "clearances_status_idx" ON "student_clearances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clearances_pending_idx" ON "student_clearances" USING btree ("status") WHERE "student_clearances"."status" = 'pending' AND "student_clearances"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clearances_enrollment_type_uidx" ON "student_clearances" USING btree ("enrollment_id","clearance_type") WHERE "student_clearances"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "student_discounts_student_idx" ON "student_discounts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_discounts_assessment_idx" ON "student_discounts" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "student_discounts_request_idx" ON "student_discounts" USING btree ("discount_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_discounts_request_active_uidx" ON "student_discounts" USING btree ("discount_request_id") WHERE "student_discounts"."reversed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sgl_student_idx" ON "student_guardian_links" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_guardian_links_guardian_idx" ON "student_guardian_links" USING btree ("guardian_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_ref_idx" ON "students" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "students_name_idx" ON "students" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "subjects_curriculum_idx" ON "subjects" USING btree ("curriculum_id");--> statement-breakpoint
CREATE INDEX "subjects_active_idx" ON "subjects" USING btree ("id") WHERE "subjects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ta_unique_idx" ON "teacher_assignments" USING btree ("teacher_id","subject_id","section_id","school_year_id") WHERE "teacher_assignments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ta_teacher_idx" ON "teacher_assignments" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "ta_subject_idx" ON "teacher_assignments" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "ta_active_idx" ON "teacher_assignments" USING btree ("teacher_id") WHERE "teacher_assignments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "void_requests_payment_pending_uidx" ON "void_requests" USING btree ("payment_id") WHERE "void_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "void_requests_status_idx" ON "void_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "void_requests_payment_idx" ON "void_requests" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "void_requests_requested_by_idx" ON "void_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "void_requests_pending_status_idx" ON "void_requests" USING btree ("status") WHERE "void_requests"."status" = 'pending';--> statement-breakpoint
-- Custom sequences for reference number generation
CREATE SEQUENCE IF NOT EXISTS "student_ref_seq" START WITH 1;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "bfx_reference_seq" START WITH 1; 