import { Suspense } from "react";
import { requirePortalSession } from "@/lib/auth/session";
import { getStudentAssessments } from "@/features/portal/portal.queries";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PortalPage,
  PortalSection,
  PortalMetric,
  PortalMetricGroup,
  PortalProgressBar,
  PortalRecordList,
  type PortalRecordColumn,
} from "@/features/portal/components";

// Instant navigation enabled - uses Suspense for streaming

export const metadata = { title: "My Assessments" };

type AssessmentRow = Awaited<ReturnType<typeof getStudentAssessments>>[number];

const PAGE_DESCRIPTION = "Fee assessments by school year (read-only).";

const priorYearColumns: PortalRecordColumn<AssessmentRow>[] = [
  {
    key: "schoolYear",
    label: "School year",
    mobile: "primary",
    render: (r) => <span className="font-medium">{r.schoolYear}</span>,
  },
  {
    key: "gradeLevel",
    label: "Grade level",
    mobile: "secondary",
    render: (r) => r.gradeLevelName,
  },
  {
    key: "status",
    label: "Status",
    mobile: "secondary",
    render: (r) => <StatusBadge type="billing" status={r.billingStatus} />,
  },
  {
    key: "balance",
    label: "Balance",
    align: "end",
    mobile: "primary",
    render: (r) => <CurrencyDisplay amount={Number(r.balance)} />,
  },
];

/**
 * Instant navigation - full assessments skeleton shown while data loads.
 */
export default function PortalAssessmentsPageWrapper() {
  return (
    <Suspense fallback={<AssessmentsSkeleton />}>
      <PortalAssessmentsContent />
    </Suspense>
  );
}

function AssessmentsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-4 sm:px-6 sm:py-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Current year section */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32 mt-1" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <Skeleton className="h-3 w-24 mx-auto mb-1" />
              <Skeleton className="h-6 w-20 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Prior years */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28 mt-1" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function PortalAssessmentsContent() {
  const session = await requirePortalSession();
  const rows = await getStudentAssessments(session.studentId);

  if (rows.length === 0) {
    return (
      <PortalPage title="Assessments" description={PAGE_DESCRIPTION}>
        <EmptyState
          icon="assessments"
          title="No assessments yet"
          description="Your fee assessments will appear here once you are enrolled."
        />
      </PortalPage>
    );
  }

  // Rows arrive newest-first, so the head row is the current school year. It
  // gets the detailed treatment; older years collapse into a compact list so a
  // 2019 assessment cannot outweigh this year's balance.
  const [current, ...priorYears] = rows;

  const total = Number(current.totalAmount);
  const paid = Number(current.totalPaid);
  const balance = Number(current.balance);
  const paidPercentage = total > 0 ? Math.round((paid / total) * 100) : 0;

  return (
    <PortalPage title="Assessments" description={PAGE_DESCRIPTION}>
      <PortalSection
        title={`${current.gradeLevelName}, ${current.schoolYear}`}
        subtitle="Current school year"
        badge={<StatusBadge type="billing" status={current.billingStatus} />}
      >
        <div className="space-y-4">
          <PortalProgressBar value={paidPercentage} />

          <PortalMetricGroup columns={3}>
            <PortalMetric
              label="Total assessment"
              value={<CurrencyDisplay amount={total} />}
            />
            <PortalMetric
              label="Total paid"
              tone="positive"
              value={<CurrencyDisplay amount={paid} />}
            />
            <PortalMetric
              label="Balance"
              size="lg"
              tone={balance <= 0 ? "positive" : "attention"}
              value={
                <CurrencyDisplay amount={balance} srLabel="Remaining balance" />
              }
            />
          </PortalMetricGroup>
        </div>
      </PortalSection>

      {priorYears.length > 0 ? (
        <PortalSection
          title="Previous school years"
          subtitle={`${priorYears.length} earlier ${
            priorYears.length === 1 ? "assessment" : "assessments"
          }`}
          padded={false}
        >
          <PortalRecordList
            columns={priorYearColumns}
            rows={priorYears}
            getRowKey={(r) => r.id}
            caption="Assessments from previous school years"
          />
        </PortalSection>
      ) : null}
    </PortalPage>
  );
}
