-- Migration: Add soft-delete fields to fee_templates
ALTER TABLE fee_templates ADD COLUMN deleted_at timestamp;
ALTER TABLE fee_templates ADD COLUMN deleted_by uuid REFERENCES users(id);
CREATE INDEX fee_templates_deleted_idx ON fee_templates(deleted_at);
