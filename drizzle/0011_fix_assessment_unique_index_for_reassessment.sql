ALTER TABLE "discount_requests" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "discount_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."discount_request_status";--> statement-breakpoint
CREATE TYPE "public"."discount_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'reversed');--> statement-breakpoint
ALTER TABLE "discount_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."discount_request_status";--> statement-breakpoint
ALTER TABLE "discount_requests" ALTER COLUMN "status" SET DATA TYPE "public"."discount_request_status" USING "status"::"public"."discount_request_status";--> statement-breakpoint
DROP INDEX "assessments_enrollment_id_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_enrollment_id_uidx" ON "assessments" USING btree ("enrollment_id") WHERE cancelled_at IS NULL;