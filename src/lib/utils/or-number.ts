/**
 * Official Receipt number formatting stored in `payments.or_number`.
 * Format: "{prefix} {paddedSequence}" (e.g. AK 00050).
 * Policy: sequence is always exactly 5 digits (00001–99999).
 */

export const OR_SEQUENCE_PAD = 5;

/** Regex for validating OR number format: "XX 00000" (2 letters, space, 5 digits) */
export const OR_NUMBER_REGEX = /^[A-Za-z]{2}\s\d{5}$/;

export function orNumberPadWidth(): number {
  return OR_SEQUENCE_PAD;
}

export function formatStoredOrNumber(prefix: string, sequence: number): string {
  const p = prefix.trim();
  const seq = Math.floor(sequence);
  return `${p} ${String(seq).padStart(OR_SEQUENCE_PAD, "0")}`;
}

/**
 * Parse OR number string into prefix + sequence.
 * @param orNumber e.g. "AK 00050"
 * @returns { prefix: "AK", sequence: 50 } or null if invalid format
 */
export function parseOrNumber(orNumber: string): { prefix: string; sequence: number } | null {
  const normalized = orNumber.trim().toUpperCase();
  const match = normalized.match(/^([A-Z]{2})\s(\d{5})$/);
  if (!match) return null;
  return { prefix: match[1], sequence: parseInt(match[2], 10) };
}
