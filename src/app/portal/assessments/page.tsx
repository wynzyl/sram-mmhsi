import { requirePortalSession } from "@/lib/auth/session";
import { getStudentAssessments } from "@/features/portal/portal.queries";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  PortalPage,
  PortalSection,
  PortalMetric,
  PortalMetricGroup,
  PortalProgressBar,
  PortalRecordList,
  type PortalRecordColumn,
} from "@/features/portal/components";

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

export default async function PortalAssessmentsPage() {
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
