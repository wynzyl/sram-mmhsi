-- Migration: Add 'inactive' status to booklet_status enum
-- This allows admins to deactivate booklets without voiding them

ALTER TYPE "public"."booklet_status" ADD VALUE 'inactive';
