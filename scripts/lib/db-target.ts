/**
 * Connection banner helper for host-side DB scripts.
 *
 * Prints which database a script is about to touch (host:port/db — never the
 * password) so a wrong target is immediately obvious. Added after a stale
 * second SRAMS_DB on localhost:5432 was found shadowing the live Docker DB on
 * localhost:5434 (Phase 11 E2E audit, finding F1).
 */
export function describeDbTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

export function logDbTarget(scriptName: string, url: string): void {
  console.log(`[${scriptName}] target database: ${describeDbTarget(url)}`);
}
