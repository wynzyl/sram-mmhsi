ALTER TABLE "receipt_booklets" ADD COLUMN IF NOT EXISTS "prefix" text;--> statement-breakpoint
UPDATE "receipt_booklets" SET "prefix" = trim(both from "series") WHERE "prefix" IS NULL;--> statement-breakpoint
UPDATE "receipt_booklets" SET "prefix" = 'OR' WHERE "prefix" IS NULL OR trim(both from "prefix") = '';--> statement-breakpoint
ALTER TABLE "receipt_booklets" ALTER COLUMN "prefix" SET NOT NULL;--> statement-breakpoint
