import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAdminDashboardMetrics } from "@/lib/queries/admin-dashboard";
import { formatCurrency } from "@/lib/utils/currency";
import { StatCard } from "@/components/ui/stat-card";
import { FinanceInsightsSection } from "@/components/dashboard/FinanceInsightsSection";

export const metadata: Metadata = { title: "Dashboard" };

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelta(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

export default async function AdminDashboardPage() {
  const metrics = await getAdminDashboardMetrics();

  if (!metrics.activeSchoolYear) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">
              Operations Overview
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              No active school year is configured yet.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Setup Required
          </h2>
          <p className="text-sm text-muted-foreground">
            Activate a school year to load enrollment and financial KPIs.
          </p>
          <div className="mt-4 flex max-w-[260px] flex-col gap-2">
            <Link
              href="/staff/school-years"
              className="block rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-muted hover:text-primary"
            >
              Manage School Years
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const enrolledSubtext = `vs last SY (${metrics.previousYearEnrolled}): ${formatDelta(metrics.enrollmentDelta)}`;
  const conversionSubtext = `${metrics.totalEnrolled} of ${metrics.approvedRegistrations} approved registrations`;
  const collectionSubtext = `Based on ${formatCurrency(metrics.totalCollectedMtd)} collected this month`;
  const overdueSubtext = `${metrics.overdueAccountsCount} account${metrics.overdueAccountsCount === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            Operations Overview
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Key enrollment and finance KPIs for SY {metrics.activeSchoolYear.label}.
          </p>
        </div>
      </header>

      <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Enrolled (vs target)"
          value={String(metrics.totalEnrolled)}
          subtext={enrolledSubtext}
          iconType="enrollment"
        />
        <StatCard
          label="Enrollment Conversion Rate"
          value={formatPercent(metrics.enrollmentConversionRate)}
          subtext={conversionSubtext}
          iconType="conversion"
        />
        <StatCard
          label="Total Collected (MTD)"
          value={formatCurrency(metrics.totalCollectedMtd)}
          iconType="collection"
        />
        <StatCard
          label="Collection Rate"
          value={formatPercent(metrics.collectionRate)}
          subtext={collectionSubtext}
          iconType="rate"
        />
        <StatCard
          label="Outstanding Receivables (A/R)"
          value={formatCurrency(metrics.outstandingReceivables)}
          iconType="receivables"
        />
        <StatCard
          label="Overdue Accounts (count + amount)"
          value={formatCurrency(metrics.overdueAccountsAmount)}
          subtext={overdueSubtext}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            KPI Scope
          </h2>
          <p className="text-sm text-muted-foreground">
            Metrics are derived from active school-year enrollment records,
            assessments, posted payments, and overdue invoice-linked balances.
          </p>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Quick Actions
          </h2>
          <div className="flex flex-col gap-2">
            <Link
              href="/admin/users"
              className="block rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-muted hover:text-primary"
            >
              Manage Users
            </Link>
            <Link
              href="/staff/school-years"
              className="block rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-muted hover:text-primary"
            >
              Manage School Years
            </Link>
            <Link
              href="/staff/dashboard"
              className="block rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-muted hover:text-primary"
            >
              Open Staff Operations
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
