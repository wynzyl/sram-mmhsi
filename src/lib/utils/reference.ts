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
