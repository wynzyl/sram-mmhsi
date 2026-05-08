DROP INDEX IF EXISTS "pa_payment_id_idx";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "booklet_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "or_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_or_number_required_when_consumed" CHECK (("payments"."or_status" <> 'consumed' OR "payments"."or_number" IS NOT NULL));