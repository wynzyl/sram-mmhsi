import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getAdminDashboardMetrics } from "@/lib/queries/admin-dashboard";
import { formatCurrency } from "@/lib/utils/currency";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { FinanceInsightsSection } from "@/components/dashboard/FinanceInsightsSection";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const QUICK_LINKS = [
  {
    href: "/staff/assessments",
    title: "Assessments",
    description: "View and manage student fee assessments.",
  },
  {
    href: "/staff/finance/fee-schedules",
    title: "Fee Schedules",
    description: "Configure fee structures for each school year and grade level.",
  },
  {
    href: "/staff/finance/booklets",
    title: "OR Booklets",
    description: "Create and manage official receipt booklets for cashiers.",
  },
  {
    href: "/staff/finance/invoices",
    title: "Invoices",
    description: "Send and track invoices for outstanding student balances.",
  },
];

export default async function FinanceOfficerDashboardPage() {
  const session = await requireSession();

  if (session.role !== "finance_officer") {
    redirect("/login");
  }

  const metrics = await getAdminDashboardMetrics();

  return (
    <PageContainer>
      <PageHeader
        title="Finance Dashboard"
        description={
          metrics.activeSchoolYear
            ? `Collection and receivables overview for SY ${metrics.activeSchoolYear.label}.`
            : "Manage fee schedules, OR booklets, invoices, and student assessments."
        }
      />

      {metrics.activeSchoolYear ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Collected (MTD)"
              value={formatCurrency(metrics.totalCollectedMtd)}
              iconType="collection"
            />
            <StatCard
              label="Collection Rate"
              value={formatPercent(metrics.collectionRate)}
              iconType="rate"
            />
            <StatCard
              label="Outstanding Receivables (A/R)"
              value={formatCurrency(metrics.outstandingReceivables)}
              iconType="receivables"
            />
            <StatCard
              label="Overdue Accounts"
              value={formatCurrency(metrics.overdueAccountsAmount)}
              subtext={`${metrics.overdueAccountsCount} account${
                metrics.overdueAccountsCount === 1 ? "" : "s"
              }`}
              iconType="overdue"
            />
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
                <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
              </div>
            }
          >
            <FinanceInsightsSection schoolYearId={metrics.activeSchoolYear.id} />
          </Suspense>
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            No active school year
          </h2>
          <p className="text-sm text-muted-foreground">
            Activate a school year to load collection and receivables metrics.
          </p>
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
