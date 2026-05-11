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
