import { redirect } from "next/navigation";
import { requirePortalSession, getPortalUser } from "@/lib/auth/session";
import { getPortalDashboardSummary } from "@/features/portal/portal.queries";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import {
  PortalPage,
  PortalBalanceCard,
  PortalGradesSnapshotCard,
  PortalMetric,
  PortalMetricGroup,
} from "@/features/portal/components";

export const metadata = { title: "Dashboard" };

export default async function PortalDashboardPage() {
  const session = await requirePortalSession();

  const [user, summary] = await Promise.all([
    getPortalUser(),
    getPortalDashboardSummary(session.studentId),
  ]);

  if (!user) redirect("/login");

  return (
    <PortalPage
      title={`Welcome, ${user.student.firstName}`}
      description="Your balance, payments and grades for this school year."
    >
      {/*
        One account, two readers. The parent signs in for the balance and the
        student for grades, so each gets an anchor of equal footprint rather
        than the three identical cards this page used to show. Balance is
        first in DOM order, so it leads on a phone: money is time-sensitive
        and actionable, grades are informational.
      */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PortalBalanceCard
          balance={summary.assessmentBalance}
          billingStatus={summary.billingStatus}
        />
        <PortalGradesSnapshotCard
          publishedGradeCount={summary.publishedGradeCount}
          latestGradePeriod={summary.latestGradePeriod}
          latestPeriodAverage={summary.latestPeriodAverage}
        />
      </div>

      <PortalMetricGroup columns={2}>
        <PortalMetric
          label="Paid this school year"
          tone={summary.totalPaidThisYear > 0 ? "positive" : "neutral"}
          value={<CurrencyDisplay amount={summary.totalPaidThisYear} />}
        />
        <PortalMetric
          label="Last payment"
          value={
            summary.lastPaymentDate ? (
              formatDate(summary.lastPaymentDate)
            ) : (
              <span className="text-muted-foreground">None recorded</span>
            )
          }
        />
      </PortalMetricGroup>
    </PortalPage>
  );
}
