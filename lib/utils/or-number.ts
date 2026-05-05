/**
 * Official Receipt number formatting stored in `payments.or_number`.
 * Format: "{prefix} {paddedSequence}" (e.g. AK 00050).
 * Policy: sequence is always exactly 5 digits (00001–99999).
 */

export const OR_SEQUENCE_PAD = 5;

export function orNumberPadWidth(): number {
  return OR_SEQUENCE_PAD;
}

export function formatStoredOrNumber(prefix: string, sequence: number): string {
  const p = prefix.trim();
  const seq = Math.floor(sequence);
  return `${p} ${String(seq).padStart(OR_SEQUENCE_PAD, "0")}`;
}
