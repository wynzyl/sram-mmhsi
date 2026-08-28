-- Migration: Add idempotency tracking columns to invoices table
-- Purpose: Enable duplicate send prevention via lastSentAt timestamp and send count tracking

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "last_sent_at" TIMESTAMP;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sent_count" INTEGER DEFAULT 0;

-- Update existing sent invoices to have consistent sentCount
UPDATE "invoices" SET "sent_count" = 1 WHERE "sent_at" IS NOT NULL AND "sent_count" IS NULL;
