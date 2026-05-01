-- First, add address as nullable
ALTER TABLE "parents_guardians" ADD COLUMN "address" text;--> statement-breakpoint
-- Set default value for existing records (empty string or placeholder)
UPDATE "parents_guardians" SET "address" = 'N/A' WHERE "address" IS NULL;--> statement-breakpoint
-- Now make it NOT NULL
ALTER TABLE "parents_guardians" ALTER COLUMN "address" SET NOT NULL;--> statement-breakpoint
-- Add occupation (nullable)
ALTER TABLE "parents_guardians" ADD COLUMN "occupation" text;--> statement-breakpoint
-- Set NOT NULL on existing columns (only if they don't have nulls)
UPDATE "parents_guardians" SET "contact_number" = 'N/A' WHERE "contact_number" IS NULL;--> statement-breakpoint
UPDATE "parents_guardians" SET "email" = 'noemail@placeholder.com' WHERE "email" IS NULL;--> statement-breakpoint
ALTER TABLE "parents_guardians" ALTER COLUMN "contact_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parents_guardians" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "lrn" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "mobile_number" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "nationality" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "blood_type" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "religion" text;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_lrn_unique" UNIQUE("lrn");