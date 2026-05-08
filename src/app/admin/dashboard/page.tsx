import type { Metadata } from "next";
import Link from "next/link";
import { getAdminDashboardMetrics } from "@/lib/queries/admin-dashboard";
import { formatCurrency } from "@/lib/utils/currency";

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
      <div className="dashboard">
        <header className="page-header">
          <div>
            <h1 className="page-title">Operations Overview</h1>
            <p className="page-subtitle">No active school year is configured yet.</p>
          </div>
        </header>

        <section className="dash-card">
          <h2 className="dash-card-title">Setup Required</h2>
          <p className="dash-empty">
            Activate a school year to load enrollment and financial KPIs.
          </p>
          <div className="quick-actions" style={{ marginTop: "0.75rem" }}>
            <Link href="/staff/school-years" className="quick-action-btn">Manage School Years</Link>
          </div>
        </section>

        <style>{`
          .dashboard { display: flex; flex-direction: column; gap: 1.5rem; }
          .page-header { display: flex; align-items: center; justify-content: space-between; }
          .page-title { font-size: 1.25rem; font-weight: 700; color: var(--color-text); }
          .page-subtitle { font-size: 0.8rem; color: var(--color-text-muted); margin-top: 2px; }
          .dash-card {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-lg);
            padding: 1.25rem;
          }
          .dash-card-title { font-size: 0.875rem; font-weight: 600; color: var(--color-text); margin-bottom: 0.75rem; }
          .dash-empty { font-size: 0.8rem; color: var(--color-text-muted); }
          .quick-actions { display: flex; flex-direction: column; gap: 0.5rem; max-width: 260px; }
          .quick-action-btn {
            display: block;
            padding: 0.5rem 0.75rem;
            border: 1px solid var(--color-border-2);
            border-radius: var(--radius);
            font-size: 0.825rem;
            color: var(--color-text-2);
            text-decoration: none;
            transition: background 0.1s, border-color 0.1s;
          }
          .quick-action-btn:hover { background: var(--color-surface-3); border-color: var(--color-primary); color: var(--color-primary); }
        `}</style>
      </div>
    );
  }

  const enrolledSubtext = `vs last SY (${metrics.previousYearEnrolled}): ${formatDelta(metrics.enrollmentDelta)}`;
  const conversionSubtext = `${metrics.totalEnrolled} of ${metrics.approvedRegistrations} approved registrations`;
  const collectionSubtext = `Based on ${formatCurrency(metrics.totalCollectedMtd)} collected this month`;
  const overdueSubtext = `${metrics.overdueAccountsCount} account${metrics.overdueAccountsCount === 1 ? "" : "s"}`;

  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <h1 className="page-title">Operations Overview</h1>
          <p className="page-subtitle">Key enrollment and finance KPIs for SY {metrics.activeSchoolYear.label}.</p>
        </div>
      </header>

      <div className="stat-grid">
        <StatCard
          label="Total Enrolled (vs target)"
          value={String(metrics.totalEnrolled)}
          subtext={enrolledSubtext}
          icon="🎓"
          color="primary"
        />
        <StatCard
          label="Enrollment Conversion Rate"
          value={formatPercent(metrics.enrollmentConversionRate)}
          subtext={conversionSubtext}
          icon="📈"
          color="accent"
        />
        <StatCard
          label="Total Collected (MTD)"
          value={formatCurrency(metrics.totalCollectedMtd)}
          icon="💰"
          color="warning"
        />
        <StatCard
          label="Collection Rate"
          value={formatPercent(metrics.collectionRate)}
          subtext={collectionSubtext}
          icon="📊"
          color="info"
        />
        <StatCard
          label="Outstanding Receivables (A/R)"
          value={formatCurrency(metrics.outstandingReceivables)}
          icon="🧾"
          color="warning"
        />
        <StatCard
          label="Overdue Accounts (count + amount)"
          value={formatCurrency(metrics.overdueAccountsAmount)}
          subtext={overdueSubtext}
          icon="⚠️"
          color="primary"
        />
      </div>

      <div className="dashboard-sections">
        <section className="dash-card">
          <h2 className="dash-card-title">KPI Scope</h2>
          <p className="dash-empty">
            Metrics are derived from active school-year enrollment records, assessments, posted
            payments, and overdue invoice-linked balances.
          </p>
        </section>
        <section className="dash-card">
          <h2 className="dash-card-title">Quick Actions</h2>
          <div className="quick-actions">
            <Link href="/admin/users" className="quick-action-btn">Manage Users</Link>
            <Link href="/staff/school-years" className="quick-action-btn">Manage School Years</Link>
            <Link href="/staff/dashboard" className="quick-action-btn">Open Staff Operations</Link>
          </div>
        </section>
      </div>

      <style>{`
        .dashboard { display: flex; flex-direction: column; gap: 1.5rem; }
        .page-header { display: flex; align-items: center; justify-content: space-between; }
        .page-title { font-size: 1.25rem; font-weight: 700; color: var(--color-text); }
        .page-subtitle { font-size: 0.8rem; color: var(--color-text-muted); margin-top: 2px; }
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }
        .stat-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.125rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .stat-icon {
          font-size: 1.5rem;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius);
          background: var(--color-surface-3);
          flex-shrink: 0;
        }
        .stat-label { font-size: 0.75rem; color: var(--color-text-muted); }
        .stat-value { font-size: 1.375rem; font-weight: 700; color: var(--color-text); line-height: 1.2; }
        .stat-subtext { margin-top: 0.15rem; font-size: 0.72rem; color: var(--color-text-muted); }
        .dashboard-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .dash-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
        }
        .dash-card-title { font-size: 0.875rem; font-weight: 600; color: var(--color-text); margin-bottom: 0.75rem; }
        .dash-empty { font-size: 0.8rem; color: var(--color-text-muted); }
        .quick-actions { display: flex; flex-direction: column; gap: 0.5rem; }
        .quick-action-btn {
          display: block;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--color-border-2);
          border-radius: var(--radius);
          font-size: 0.825rem;
          color: var(--color-text-2);
          text-decoration: none;
          transition: background 0.1s, border-color 0.1s;
        }
        .quick-action-btn:hover { background: var(--color-surface-3); border-color: var(--color-primary); color: var(--color-primary); }
      `}</style>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  color,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: string;
  color: "primary" | "accent" | "warning" | "info";
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {subtext ? <p className="stat-subtext">{subtext}</p> : null}
      </div>
    </div>
  );
}
