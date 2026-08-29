import { requirePortalSession } from "@/lib/auth/session";
import { getStudentAssessments } from "@/features/portal/portal.queries";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

export const metadata = { title: "My Assessments" };

export default async function PortalAssessmentsPage() {
  const session = await requirePortalSession();
  const rows = await getStudentAssessments(session.studentId);

  if (rows.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="Assessments" description="Fee assessments by school year (read-only)." />
        <EmptyState
          icon="assessments"
          title="No assessments yet"
          description="Your fee assessments will appear here once you are enrolled."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Assessments" description="Fee assessments by school year (read-only)." />

      <div className="space-y-6">
        {rows.map((r) => {
          const total = Number(r.totalAmount);
          const paid = Number(r.totalPaid);
          const balance = Number(r.balance);
          const paidPercentage = total > 0 ? Math.round((paid / total) * 100) : 0;

          return (
            <div key={r.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-muted px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {r.gradeLevelName} - {r.schoolYear}
                    </h2>
                  </div>
                  <StatusBadge type="billing" status={r.billingStatus} />
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Payment Progress</span>
                    <span className="font-medium text-foreground">{paidPercentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        paidPercentage >= 100
                          ? "bg-success"
                          : paidPercentage >= 50
                          ? "bg-primary"
                          : "bg-warning"
                      }`}
                      style={{ width: `${Math.min(paidPercentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Amount Details */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Assessment</p>
                    <p className="text-lg font-bold text-foreground">
                      <CurrencyDisplay amount={total} />
                    </p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Paid</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      <CurrencyDisplay amount={paid} />
                    </p>
                  </div>
                  <div className={`text-center p-3 rounded-lg ${
                    balance <= 0
                      ? "bg-green-50 dark:bg-green-900/20"
                      : "bg-red-50 dark:bg-red-900/20"
                  }`}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Balance</p>
                    <p className={`text-lg font-bold ${
                      balance <= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      <CurrencyDisplay amount={balance} />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}
