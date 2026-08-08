import { timingSafeEqual } from "crypto";

/**
 * Timing-safe comparison of two strings.
 * Prevents timing attacks by always comparing the same number of bytes.
 *
 * Shared by the /api/cron/* endpoints so the Bearer-secret check is defined
 * once — a second hand-rolled copy is how one endpoint quietly ends up with a
 * short-circuiting `===`.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  // If lengths differ, compare against a same-length dummy to prevent timing leak
  if (aBuffer.length !== bBuffer.length) {
    // Compare b against itself (same length) to maintain constant time
    timingSafeEqual(bBuffer, bBuffer);
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}
