-- Custom migration: add the student_ref_seq sequence used by getNextStudentSequence()
-- in src/features/students/students.actions.ts to atomically allocate student reference numbers.
-- Without this sequence, student creation fails with "relation student_ref_seq does not exist"
-- which the action catches and surfaces as the generic "An unexpected error occurred" message.

CREATE SEQUENCE IF NOT EXISTS "student_ref_seq" START WITH 1;--> statement-breakpoint

-- Re-baseline the sequence to one past the highest existing reference so freshly
-- created students cannot collide with rows seeded outside the sequence.
DO $$
DECLARE
  max_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(reference_number FROM '\d{5}$') AS INTEGER
    )
  ), 0) INTO max_seq
  FROM students
  WHERE reference_number ~ '^SRAMS-\d{4}-\d{5}$';

  PERFORM setval('student_ref_seq', GREATEST(max_seq, 1), max_seq > 0);
END $$;
