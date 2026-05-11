-- Create sequence for atomic student reference number generation
CREATE SEQUENCE IF NOT EXISTS student_ref_seq START WITH 1;

-- Initialize sequence to current max + 1 to prevent collisions
-- Extract numeric part from existing reference numbers (format: SRAMS-YYYY-NNNNN)
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

  -- Set sequence to max + 1
  PERFORM setval('student_ref_seq', max_seq + 1, false);
END $$;
