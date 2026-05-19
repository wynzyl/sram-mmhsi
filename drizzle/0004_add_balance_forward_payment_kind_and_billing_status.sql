ALTER TYPE "public"."assessment_billing_status" ADD VALUE 'balance_forwarded';--> statement-breakpoint
ALTER TYPE "public"."payment_kind" ADD VALUE 'balance_forward';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'balance_forward';