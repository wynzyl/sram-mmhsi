-- Drop indexes that reference the status column with WHERE clauses
DROP INDEX IF EXISTS "discount_requests_enrollment_type_uidx";--> statement-breakpoint
DROP INDEX IF EXISTS "discount_requests_pending_idx";--> statement-breakpoint

-- Drop default before changing type
ALTER TABLE "discount_requests" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint

-- Change column to text temporarily
ALTER TABLE "discount_requests" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint

-- Drop old enum and create new one with additional values
DROP TYPE "public"."discount_request_status";--> statement-breakpoint
CREATE TYPE "public"."discount_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'reversed');--> statement-breakpoint

-- Change column back to enum
ALTER TABLE "discount_requests" ALTER COLUMN "status" SET DATA TYPE "public"."discount_request_status" USING "status"::"public"."discount_request_status";--> statement-breakpoint

-- Set new default
ALTER TABLE "discount_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."discount_request_status";--> statement-breakpoint

-- Recreate indexes
CREATE UNIQUE INDEX "discount_requests_enrollment_type_uidx" ON "discount_requests" USING btree ("enrollment_id","discount_type_id") WHERE "status" IN ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "discount_requests_pending_idx" ON "discount_requests" USING btree ("status") WHERE "status" = 'pending';--> statement-breakpoint

-- Fix assessments unique index for reassessment support
DROP INDEX IF EXISTS "assessments_enrollment_id_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_enrollment_id_uidx" ON "assessments" USING btree ("enrollment_id") WHERE cancelled_at IS NULL;
