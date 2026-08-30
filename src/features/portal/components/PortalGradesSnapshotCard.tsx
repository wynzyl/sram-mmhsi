import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  GRADING_PERIOD_LABELS,
  type GradingPeriod,
} from "@/lib/constants/grading-periods";
import { PortalSection } from "./PortalSection";
import { PortalGradeValue } from "./PortalGradeValue";

interface PortalGradesSnapshotCardProps {
  publishedGradeCount: number;
  latestGradePeriod: string | null;
  /** Mean grade across the latest published period, when available. */
  latestPeriodAverage?: number | null;
  href?: string;
}

/**
 * Academic anchor on the portal dashboard.
 *
 * Counterpart to PortalBalanceCard: the same account is also used by the
 * student, who signed in for grades rather than fees. Given equal footprint so
 * neither reader has to hunt. Leads with the latest period's average, the one
 * number a student actually wants; the published-grade count is the fallback
 * when no average exists yet.
 */
export function PortalGradesSnapshotCard({
  publishedGradeCount,
  latestGradePeriod,
  latestPeriodAverage = null,
  href = "/portal/grades",
}: PortalGradesSnapshotCardProps) {
  const periodLabel = latestGradePeriod
    ? (GRADING_PERIOD_LABELS[latestGradePeriod as GradingPeriod] ??
      latestGradePeriod)
    : null;

  return (
    <PortalSection
      title={
        latestPeriodAverage !== null && periodLabel
          ? `${periodLabel} average`
          : "Published grades"
      }
      subtitle={
        latestPeriodAverage !== null && periodLabel
          ? `${publishedGradeCount} ${
              publishedGradeCount === 1 ? "grade" : "grades"
            } published`
          : periodLabel
            ? `Most recent: ${periodLabel}`
            : undefined
      }
      footer={
        <Link
          href={href}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          View grades
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      }
      className="h-full"
    >
      {publishedGradeCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          No grades published yet. They appear here once your teachers submit
          and the principal approves them.
        </p>
      ) : latestPeriodAverage !== null ? (
        <PortalGradeValue
          grade={latestPeriodAverage}
          showRemark
          className="text-3xl font-bold tracking-tight sm:text-4xl"
        />
      ) : (
        <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums sm:text-4xl">
          {publishedGradeCount}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {publishedGradeCount === 1 ? "grade" : "grades"}
          </span>
        </p>
      )}
    </PortalSection>
  );
}
