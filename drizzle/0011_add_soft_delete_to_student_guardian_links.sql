-- Migration: Add soft-delete fields to student_guardian_links
ALTER TABLE student_guardian_links ADD COLUMN deleted_at timestamp;
ALTER TABLE student_guardian_links ADD COLUMN deleted_by uuid REFERENCES users(id);
CREATE INDEX sgl_deleted_idx ON student_guardian_links(deleted_at);
