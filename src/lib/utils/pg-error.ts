/** Walk drizzle/postgres error chain for the underlying Postgres message/codes. */
export function collectPgErrorText(err: unknown): string {
  const parts: string[] = [];
  let e: unknown = err;
  const seen = new Set<unknown>();
  let depth = 0;
  while (e && typeof e === "object" && !seen.has(e) && depth < 8) {
    seen.add(e);
    depth += 1;
    const o = e as {
      message?: string;
      detail?: string;
      code?: string;
      constraint?: string;
      column?: string;
      cause?: unknown;
    };
    if (typeof o.message === "string") parts.push(o.message);
    if (typeof o.detail === "string") parts.push(o.detail);
    if (typeof o.code === "string") parts.push(`code:${o.code}`);
    if (typeof o.constraint === "string") parts.push(`constraint:${o.constraint}`);
    e = o.cause;
  }
  return parts.join(" | ");
}

/** Missing column / undefined_column — usually migration not applied. */
export function isUndefinedColumnError(err: unknown): boolean {
  const t = collectPgErrorText(err).toLowerCase();
  return (
    t.includes("42703") ||
    (t.includes("column") && t.includes("does not exist")) ||
    t.includes("undefined_column")
  );
}

/** Missing table / undefined_table (42P01) — usually migration not applied. */
export function isUndefinedTableError(err: unknown): boolean {
  const t = collectPgErrorText(err).toLowerCase();
  return (
    t.includes("42p01") ||
    (t.includes("relation") && t.includes("does not exist")) ||
    t.includes("undefined_table")
  );
}

/** Unique-constraint violation (23505 / unique_violation). */
export function isUniqueViolationError(err: unknown): boolean {
  const t = collectPgErrorText(err).toLowerCase();
  return (
    t.includes("23505") ||
    t.includes("duplicate key") ||
    t.includes("unique_violation")
  );
}

/** Foreign-key violation (23503 / foreign_key_violation). */
export function isForeignKeyViolationError(err: unknown): boolean {
  const t = collectPgErrorText(err).toLowerCase();
  return (
    t.includes("23503") ||
    t.includes("foreign key") ||
    t.includes("foreign_key_violation")
  );
}
