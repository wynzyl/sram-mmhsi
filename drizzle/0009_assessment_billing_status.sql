DO $do$
BEGIN
  CREATE TYPE "public"."assessment_billing_status" AS ENUM('outstanding', 'fully_paid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "billing_status" "assessment_billing_status" DEFAULT 'outstanding' NOT NULL;--> statement-breakpoint
UPDATE "assessments" SET "billing_status" = CASE
  WHEN "balance"::numeric <= 0 THEN 'fully_paid'::"public"."assessment_billing_status"
  ELSE 'outstanding'::"public"."assessment_billing_status"
END;
