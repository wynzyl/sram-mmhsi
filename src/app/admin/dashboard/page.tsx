import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">System overview and quick access</p>
        </div>
      </header>

      <div className="stat-grid">
        <StatCard label="Total Students" value="—" icon="👨‍🎓" color="primary" />
        <StatCard label="Active Enrollments" value="—" icon="📋" color="accent" />
        <StatCard label="Pending Payments" value="—" icon="💳" color="warning" />
        <StatCard label="Pending Registrations" value="—" icon="📝" color="info" />
      </div>

      <div className="dashboard-sections">
        <section className="dash-card">
          <h2 className="dash-card-title">Recent Activity</h2>
          <p className="dash-empty">No recent activity yet.</p>
        </section>
        <section className="dash-card">
          <h2 className="dash-card-title">Quick Actions</h2>
          <div className="quick-actions">
            <a href="/staff/students/new" className="quick-action-btn">+ New Student</a>
            <a href="/staff/registrations" className="quick-action-btn">View Registrations</a>
            <a href="/staff/payments" className="quick-action-btn">Post Payment</a>
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
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: "primary" | "accent" | "warning" | "info";
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
      </div>
    </div>
  );
}
