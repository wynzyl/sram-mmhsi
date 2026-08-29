import { requirePortalSession, getPortalUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import Link from "next/link";
import { getPortalDashboardSummary } from "@/features/portal/portal.queries";
import { formatDate } from "@/lib/utils/date";
import { GRADING_PERIOD_LABELS, type GradingPeriod } from "@/lib/constants/grading-periods";

export default async function PortalDashboardPage() {
  const session = await requirePortalSession();

  // Fetch user and dashboard summary in parallel
  const [user, summary] = await Promise.all([
    getPortalUser(),
    getPortalDashboardSummary(session.studentId),
  ]);

  if (!user) redirect("/login");

  // Display student's name
  const displayName = `${user.student.firstName} ${user.student.lastName}`;

  // Format billing status for badge
  const getBillingBadgeVariant = (status: string | null): "success" | "warning" | "danger" | "secondary" => {
    switch (status) {
      case "settled":
        return "success";
      case "outstanding":
        return "warning";
      case "overdue":
        return "danger";
      default:
        return "secondary";
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome, ${displayName}`}
        description="View your academic and payment information below."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Assessments Card */}
        <Link
          href="/portal/assessments"
          className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="View assessments and outstanding balance"
        >
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>Assessments</CardTitle>
                {summary.billingStatus && (
                  <Badge variant={getBillingBadgeVariant(summary.billingStatus)} className="capitalize">
                    {summary.billingStatus}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {summary.assessmentBalance !== null ? (
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-foreground">
                    <CurrencyDisplay amount={summary.assessmentBalance} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Outstanding balance
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active assessment
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Payments Card */}
        <Link
          href="/portal/payments"
          className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="View payment history and official receipts"
        >
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.totalPaidThisYear > 0 || summary.lastPaymentDate ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      <CurrencyDisplay amount={summary.totalPaidThisYear} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Paid this school year
                    </p>
                  </div>
                  {summary.lastPaymentDate && (
                    <p className="text-xs text-muted-foreground">
                      Last payment: {formatDate(summary.lastPaymentDate)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No payments recorded
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Grades Card */}
        <Link
          href="/portal/grades"
          className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="View quarterly grades and academic performance"
        >
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle>Grades</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.publishedGradeCount > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-foreground">
                      {summary.publishedGradeCount}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {summary.publishedGradeCount === 1 ? "grade" : "grades"} published
                    </p>
                  </div>
                  {summary.latestGradePeriod && (
                    <p className="text-xs text-muted-foreground">
                      Latest: {GRADING_PERIOD_LABELS[summary.latestGradePeriod as GradingPeriod] ?? summary.latestGradePeriod}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No grades published yet
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}
