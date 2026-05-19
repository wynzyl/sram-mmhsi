-- Custom migration: add the bfx_reference_seq sequence used by generateNextBfxNumber()
-- in src/lib/utils/reference.ts to atomically allocate BFX (Balance Forward Transfer
-- Receipt) reference numbers. The previous select-MAX-then-increment logic was not
-- concurrency-safe: two concurrent enrollment commits could read the same max and
-- produce duplicate BFX-NNNNN references.

CREATE SEQUENCE IF NOT EXISTS "bfx_reference_seq" START WITH 1;--> statement-breakpoint

-- Re-baseline the sequence to one past the highest existing BFX reference so newly
-- allocated numbers cannot collide with rows already in payments.reference_number.
DO $$
DECLARE
  max_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(reference_number FROM 'BFX-([0-9]+)$') AS INTEGER
    )
  ), 0) INTO max_seq
  FROM payments
  WHERE reference_number ~ '^BFX-[0-9]+$';

  PERFORM setval('bfx_reference_seq', GREATEST(max_seq, 1), max_seq > 0);
END $$;
