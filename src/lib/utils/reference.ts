import { sql } from "drizzle-orm";

/**
 * Generates a student reference number as a 7-digit plain number.
 * e.g., 0000001, 0000002, 0000100, 9999999
 *
 * The sequence is a global incremental series managed by the PostgreSQL
 * `student_ref_seq` sequence for concurrency safety.
 *
 * @param sequence - The global sequence number from student_ref_seq
 * @returns Reference string (e.g., "0000001")
 */
export function generateStudentRef(sequence: number): string {
  return String(sequence).padStart(7, "0");
}

/**
 * Generates an invoice number in the format: INV-YYYY-NNNNN
 */
export function generateInvoiceNumber(year: number, sequence: number): string {
  const seq = String(sequence).padStart(5, "0");
  return `INV-${year}-${seq}`;
}

/**
 * Generates the next BFX (Balance Forward Transfer Receipt) number.
 * Format: BFX-NNNNN (e.g., BFX-00001, BFX-00002)
 *
 * Allocates from the `bfx_reference_seq` Postgres sequence (see migration 0006)
 * so concurrent enrollment commits cannot collide on the same number.
 */
export async function generateNextBfxNumber(
  tx: {
    execute: typeof import("@/lib/db").db.execute;
  }
): Promise<string> {
  const result = await tx.execute<{ nextval: number }>(
    sql`SELECT nextval('bfx_reference_seq') AS nextval`
  );
  const nextSeq = Number(result[0]?.nextval ?? 1);
  return `BFX-${String(nextSeq).padStart(5, "0")}`;
}

/**
 * Generates multiple BFX numbers in a single query using generate_series.
 * Format: BFX-NNNNN (e.g., BFX-00001, BFX-00002)
 *
 * Allocates `count` sequence values atomically from `bfx_reference_seq`.
 * Returns an array of BFX numbers in order.
 *
 * @param tx - Database transaction
 * @param count - Number of BFX numbers to generate
 * @returns Array of BFX numbers
 */
export async function generateBatchBfxNumbers(
  tx: {
    execute: typeof import("@/lib/db").db.execute;
  },
  count: number
): Promise<string[]> {
  if (count === 0) return [];
  if (count === 1) {
    const single = await generateNextBfxNumber(tx);
    return [single];
  }

  // Allocate `count` sequence values in a single query
  const result = await tx.execute<{ nextval: number }>(
    sql`SELECT nextval('bfx_reference_seq') AS nextval FROM generate_series(1, ${count})`
  );

  return result.map((row) => `BFX-${String(row.nextval).padStart(5, "0")}`);
}

/**
 * Formats a document number from a year and sequence.
 * Format: DOC-YYYY-NNNNN (e.g., DOC-2026-00001)
 *
 * Pure formatter only — sequence allocation lives in the document-request
 * action/query layer so the number is assigned atomically inside the same
 * transaction as the write.
 */
export function formatDocumentNumber(year: number, sequence: number): string {
  return `DOC-${year}-${String(sequence).padStart(5, "0")}`;
}
