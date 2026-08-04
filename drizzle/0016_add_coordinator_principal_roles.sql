-- Add missing role enum values: coordinator and principal
-- These roles were in the Drizzle schema but never migrated to PostgreSQL

ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'principal';
