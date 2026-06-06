/**
 * UUID v4 generator that works in NON-secure browser contexts.
 *
 * `crypto.randomUUID` is only exposed in secure contexts (HTTPS or
 * localhost). The LAN production deployment serves plain HTTP on a
 * non-localhost hostname, where `crypto.randomUUID` is `undefined` —
 * calling it crashed the payment processing page (client TypeError →
 * staff error boundary). `crypto.getRandomValues` is NOT secure-context
 * gated, so we build a spec-compliant UUID v4 from it as the fallback.
 */
export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
