/**
 * Financial & status colour utilities.
 *
 * Emits semantic token classes only - never stock Tailwind palette classes.
 * Tokens resolve per theme, so no `dark:` variants are needed.
 *
 * Guideline semantics ("the red budget"): an unpaid balance is a normal
 * state, not a failure. On day one of a term every student owes the full
 * assessment. Outstanding renders in the hold/warning tier; red starts at
 * the due date.
 */

/** Pill classes: tinted background + matching text, one pair for both themes. */
export const STATUS_PILL = {
  ok: "bg-success-tint text-success",
  hold: "bg-warning-tint text-warning",
  bad: "bg-destructive-tint text-destructive",
  note: "bg-info-tint text-info",
  idle: "bg-muted text-muted-foreground",
} as const;

interface BalanceColorOptions {
  /** When known, drives the hold -> bad transition. */
  dueDate?: Date | null;
  /** Injectable clock for tests. */
  asOf?: Date;
}

/**
 * Balance text colour.
 *
 * - settled (zero or credit): ok
 * - outstanding: hold - "no red for ordinary unpaid balances"
 * - past due (requires a due date): bad, emphasised
 */
export function getBalanceColor(
  balance: number,
  { dueDate, asOf = new Date() }: BalanceColorOptions = {},
): string {
  if (balance <= 0) return "text-success";
  const pastDue = dueDate != null && asOf > dueDate;
  return pastDue ? "text-destructive font-semibold" : "text-warning";
}

export function getPaymentStatusColor(status: string): string {
  const map: Record<string, string> = {
    paid: STATUS_PILL.ok,
    partial: STATUS_PILL.hold,
    unpaid: STATUS_PILL.hold, // unpaid is not overdue; see getBalanceColor
    past_due: STATUS_PILL.bad,
    voided: STATUS_PILL.idle,
  };
  return map[status.toLowerCase()] ?? STATUS_PILL.idle;
}

export function getEnrollmentStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: STATUS_PILL.hold,
    assessed: STATUS_PILL.hold,
    enrolled: STATUS_PILL.ok,
    cancelled: STATUS_PILL.bad,
    withdrawn: STATUS_PILL.idle,
  };
  return map[status.toLowerCase()] ?? STATUS_PILL.idle;
}

export function getBillingStatusColor(status: string): string {
  const map: Record<string, string> = {
    outstanding: STATUS_PILL.hold,
    fully_paid: STATUS_PILL.ok,
    past_due: STATUS_PILL.bad,
    balance_forwarded: STATUS_PILL.note,
    cancelled: STATUS_PILL.idle,
  };
  return map[status.toLowerCase()] ?? STATUS_PILL.idle;
}

export function getORStatusColor(status: string): string {
  const map: Record<string, string> = {
    issued: STATUS_PILL.ok,
    cancelled: STATUS_PILL.bad,
    voided: STATUS_PILL.bad,
    not_issued: STATUS_PILL.hold,
  };
  return map[status.toLowerCase()] ?? STATUS_PILL.idle;
}
