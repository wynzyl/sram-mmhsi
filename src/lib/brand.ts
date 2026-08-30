/**
 * Brand constants - the school's mark.
 *
 * Vermilion is the SRAMS identity and the alarm colour, governed by the
 * brand guideline's "red budget": brand mark, active-module indicator,
 * focus ring, blocking errors, overdue money, destructive confirm. The
 * interface's primary action is INK (--primary), never red.
 *
 * There is deliberately no bg-brand / text-brand Tailwind utility. A brand
 * red that is one utility away ends up on a balance column. DOM reaches the
 * mark through the .brand-mark / .brand-mark-bg classes in globals.css;
 * canvas, PDF and XLSX (which need literal hex) import from here.
 *
 * ALLOWED consumers:
 *   - logo / seal / wordmark lockups (via .brand-mark)
 *   - src/features/reports/shared/pdf-primitives.tsx (letterhead)
 *   - src/features/reports/shared/xlsx-report.ts
 *   - src/features/documents/document.export.tsx
 *   - src/features/finance/invoices/invoice-document.tsx (letterhead only)
 *
 * NOT allowed: status pills, balances, totals, buttons, alerts, charts,
 * table cells, badges, or anything that varies with data. "Only the overdue
 * balance earns red - and only after the due date has passed" - and overdue
 * is --destructive (red-text), not the brand mark.
 */

/** red-mark: non-text brand accent. Same value in both themes. */
export const BRAND_MARK = "#e5322d";

/** red-text: red that may carry small text (5.2:1 on white). */
export const RED_TEXT = "#c9241c";

/** Text placed on top of a solid brand fill. */
export const BRAND_FOREGROUND = "#ffffff";

/** ExcelJS wants 8-digit ARGB, not 6-digit hex. */
export const BRAND_MARK_ARGB = "FFE5322D";

/**
 * Print palette. Exports render on white paper, always in the light theme,
 * so these are fixed literals rather than theme variables.
 */
export const PRINT = {
  /** Letterhead rule and school name. Large text only (red-mark is 4.35:1). */
  brand: BRAND_MARK,
  ink: "#171614",
  muted: "#6e6963",
  line: "#e5e2dd",
  /** Emphasised figures on a statement. Ink, NOT brand red - a total is not
   *  a brand moment, and red on a balance reads as an error. */
  emphasis: "#171614",
  headerFill: "#2a2825",
  rowAlt: "#f8f7f5",
} as const;
