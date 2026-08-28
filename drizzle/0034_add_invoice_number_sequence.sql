-- Migration: Add PostgreSQL sequence for invoice numbers
-- Purpose: Prevent race conditions when generating invoice numbers in concurrent batch operations
-- The sequence stores the raw sequence number; year prefix is applied in application code

-- Create the invoice number sequence
-- Start from 1, or from max existing sequence if invoices already exist
DO $$
DECLARE
  max_seq INTEGER;
BEGIN
  -- Extract max sequence number from existing invoices (format: INV-YYYY-NNNNN)
  SELECT COALESCE(MAX(
    CASE
      WHEN invoice_number ~ '^INV-\d{4}-\d+$'
      THEN CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER)
      ELSE 0
    END
  ), 0)
  INTO max_seq
  FROM invoices;

  -- Create sequence starting after the max existing number
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH %s', max_seq + 1);
END $$;

-- Note: The sequence is NOT year-scoped. Invoice numbers use format INV-YYYY-NNNNN
-- where NNNNN is globally unique across all years. This is simpler and still prevents
-- race conditions. The unique index on invoice_number ensures no duplicates.

COMMENT ON SEQUENCE invoice_number_seq IS 'Global sequence for invoice number generation. Used by batch invoice generation to prevent race conditions.';
