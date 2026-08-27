-- Add portal_accounts table for student self-service access
-- Separate from staff users table for clean isolation

-- Create portal_accounts table
CREATE TABLE IF NOT EXISTS "portal_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "username" text NOT NULL,
  "password_hash" text NOT NULL,
  "email" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "force_password_change" boolean DEFAULT true NOT NULL,
  "last_login_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id"),
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by" uuid REFERENCES "users"("id")
);

-- Indexes for portal_accounts
-- One portal account per student (active records only)
CREATE UNIQUE INDEX "portal_accounts_student_uidx" ON "portal_accounts" ("student_id") WHERE "deleted_at" IS NULL;
-- Username must be globally unique
CREATE UNIQUE INDEX "portal_accounts_username_uidx" ON "portal_accounts" ("username");
-- Active accounts lookup (for login queries)
CREATE INDEX "portal_accounts_active_idx" ON "portal_accounts" ("is_active") WHERE "is_active" = true AND "deleted_at" IS NULL;

-- Modify sessions table to support portal accounts
-- Add portal_account_id column
ALTER TABLE "sessions" ADD COLUMN "portal_account_id" uuid REFERENCES "portal_accounts"("id") ON DELETE CASCADE;

-- Make user_id nullable (either userId OR portalAccountId must be set)
ALTER TABLE "sessions" ALTER COLUMN "user_id" DROP NOT NULL;

-- Add index for portal account sessions
CREATE INDEX "sessions_portal_account_idx" ON "sessions" ("portal_account_id");

-- Add constraint: exactly one of userId or portalAccountId must be set (XOR)
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_type_chk"
  CHECK (("user_id" IS NOT NULL AND "portal_account_id" IS NULL) OR ("user_id" IS NULL AND "portal_account_id" IS NOT NULL));
