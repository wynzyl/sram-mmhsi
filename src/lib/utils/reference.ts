import { sql } from "drizzle-orm";

/**
 * Generates a student reference number in the format: SRAMS-YYYY-NNNNN
 * e.g. SRAMS-2026-00001
 */
export function generateStudentRef(year: number, sequence: number): string {
  const seq = String(sequence).padStart(5, "0");
  return `SRAMS-${year}-${seq}`;
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
