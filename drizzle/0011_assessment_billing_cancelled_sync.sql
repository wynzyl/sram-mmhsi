UPDATE "assessments" SET "billing_status" = CASE
  WHEN "cancelled_at" IS NOT NULL THEN 'cancelled'::"public"."assessment_billing_status"
  WHEN "balance"::numeric <= 0 THEN 'fully_paid'::"public"."assessment_billing_status"
  ELSE 'outstanding'::"public"."assessment_billing_status"
END;
