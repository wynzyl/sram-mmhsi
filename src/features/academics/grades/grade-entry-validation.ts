/**
 * Grade cell input rules shared by the adviser and SHS grade entry grids.
 *
 * Pure functions only — no React, no DB. The grid components delegate keystroke
 * and commit decisions here so both grids stay in lockstep.
 *
 * These bounds mirror the server contract — `SaveGradeSheetEntriesSchema` in
 * `grades.schema.ts` requires 60–100 — so an out-of-range entry is rejected at
 * the cell instead of surfacing as a save-time error on the whole sheet.
 */

/** Lowest value a grade cell will commit on blur. Matches the server minimum. */
export const GRADE_INPUT_MIN = 60;

/** Highest value a grade cell will accept or commit. */
export const GRADE_INPUT_MAX = 100;

/**
 * Should a keystroke be accepted into the cell's local state?
 *
 * Allows an empty cell and any partial 1–3 digit number up to the maximum, so
 * the user can type "1" → "10" → "100" without the field fighting them.
 *
 * Deliberately does NOT apply `GRADE_INPUT_MIN`: every path to a valid grade
 * passes through a smaller prefix first (you cannot reach "60" without typing
 * "6"), so enforcing the floor here would make the cell impossible to fill.
 * The floor is applied on blur by `resolveGradeCommit`.
 */
export function isAcceptableGradeInput(value: string): boolean {
  if (value === "") return true;
  if (!/^\d{0,3}$/.test(value)) return false;
  return parseInt(value, 10) <= GRADE_INPUT_MAX;
}

/**
 * What a grade cell should do when it loses focus.
 *
 * - `commit` — push `value` up to the parent sheet state (empty string clears it)
 * - `revert` — the typed value is out of range; restore the cell's prior value
 */
export type GradeCommitDecision =
  | { action: "commit"; value: string }
  | { action: "revert" };

/**
 * Resolve the blur behaviour for a grade cell's current local value.
 */
export function resolveGradeCommit(localValue: string): GradeCommitDecision {
  if (localValue === "") {
    return { action: "commit", value: "" };
  }

  const numValue = parseInt(localValue, 10);

  if (
    Number.isNaN(numValue) ||
    numValue < GRADE_INPUT_MIN ||
    numValue > GRADE_INPUT_MAX
  ) {
    return { action: "revert" };
  }

  return { action: "commit", value: localValue };
}
