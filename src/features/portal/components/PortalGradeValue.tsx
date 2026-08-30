import {
  DEPED_GRADE_REMARKS,
  getGradeRemarks,
  type DepEdGradeRemarks,
} from "@/lib/constants/grading-periods";
import { cn } from "@/lib/utils/cn";

/**
 * Ink per DepEd remark band.
 *
 * These are semantic, not brand: a failing grade must read as failing under
 * every color theme, so they map to status tokens and never to --primary.
 * Two of the five bands share the neutral foreground because the palette
 * offers four meaningful steps, and weight carries the extra distinction.
 */
const REMARK_INK: Record<DepEdGradeRemarks, string> = {
  [DEPED_GRADE_REMARKS.OUTSTANDING]: "text-success font-semibold",
  [DEPED_GRADE_REMARKS.VERY_SATISFACTORY]: "text-foreground font-semibold",
  [DEPED_GRADE_REMARKS.SATISFACTORY]: "text-foreground",
  [DEPED_GRADE_REMARKS.FAIRLY_SATISFACTORY]: "text-warning",
  [DEPED_GRADE_REMARKS.DID_NOT_MEET]: "text-destructive font-semibold",
};

export function gradeRemarkInk(remark: DepEdGradeRemarks): string {
  return REMARK_INK[remark];
}

/**
 * The legend rendered beside a grade sheet. Shares REMARK_INK with the cells
 * above it, so the two can never drift apart.
 */
export const PORTAL_GRADE_BANDS = [
  { range: "90 and above", remark: DEPED_GRADE_REMARKS.OUTSTANDING },
  { range: "85 to 89", remark: DEPED_GRADE_REMARKS.VERY_SATISFACTORY },
  { range: "80 to 84", remark: DEPED_GRADE_REMARKS.SATISFACTORY },
  { range: "75 to 79", remark: DEPED_GRADE_REMARKS.FAIRLY_SATISFACTORY },
  { range: "Below 75", remark: DEPED_GRADE_REMARKS.DID_NOT_MEET },
] as const;

interface PortalGradeValueProps {
  grade: number | null;
  /** Render the DepEd remark next to the figure. Used in the mobile list. */
  showRemark?: boolean;
  className?: string;
}

/**
 * Single source of truth for how a grade is presented.
 *
 * Colour is always paired with a text remark (visible or screen-reader only),
 * so meaning is never conveyed by colour alone (WCAG 1.4.1).
 */
export function PortalGradeValue({
  grade,
  showRemark = false,
  className,
}: PortalGradeValueProps) {
  if (grade === null || !Number.isFinite(grade)) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        <span aria-hidden="true">-</span>
        <span className="sr-only">No grade recorded</span>
      </span>
    );
  }

  const remark = getGradeRemarks(grade);

  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className={cn("tabular-nums", REMARK_INK[remark])}>
        {grade.toFixed(2)}
      </span>
      {showRemark ? (
        <span className="text-xs text-muted-foreground">{remark}</span>
      ) : (
        <span className="sr-only">{remark}</span>
      )}
    </span>
  );
}
