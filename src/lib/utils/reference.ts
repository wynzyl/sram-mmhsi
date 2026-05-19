import { payments } from "@/lib/db/schema";
import { desc, like } from "drizzle-orm";

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
 * Follows the REVERSAL pattern: no booklet, simple auto-incrementing.
 * Query existing BFX payments by referenceNumber pattern to find max sequence.
 */
export async function generateNextBfxNumber(
  tx: {
    select: typeof import("@/lib/db").db.select;
  }
): Promise<string> {
  // Query existing BFX reference numbers to find the max sequence
  const result = await tx
    .select({ referenceNumber: payments.referenceNumber })
    .from(payments)
    .where(like(payments.referenceNumber, "BFX-%"))
    .orderBy(desc(payments.referenceNumber))
    .limit(1);

  let nextSeq = 1;

  if (result.length > 0 && result[0].referenceNumber) {
    const lastRef = result[0].referenceNumber;
    // Parse BFX-NNNNN format
    const match = lastRef.match(/^BFX-(\d+)$/);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }

  return `BFX-${String(nextSeq).padStart(5, "0")}`;
}
