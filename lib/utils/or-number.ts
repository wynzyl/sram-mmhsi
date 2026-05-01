/**
 * Official Receipt number formatting stored in `payments.or_number`.
 * Format: "{prefix} {paddedSequence}" (e.g. AP 00050).
 */

export function orNumberPadWidth(endNumber: number): number {
  return Math.max(String(Math.floor(endNumber)).length, 5);
}

export function formatStoredOrNumber(
  prefix: string,
  sequence: number,
  endNumber: number
): string {
  const p = prefix.trim();
  const w = orNumberPadWidth(endNumber);
  return `${p} ${String(Math.floor(sequence)).padStart(w, "0")}`;
}
