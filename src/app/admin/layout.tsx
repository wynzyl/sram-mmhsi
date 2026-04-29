import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { Role } from "@/lib/constants/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  // Double-check role at layout level (defense in depth — proxy does optimistic check)
  if (session.role !== "admin") {
    redirect("/login");
  }

  return (
    <div className="admin-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="8" fill="var(--color-primary)" />
            <path d="M10 28 L20 12 L30 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 22 H26" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="sidebar-brand-text">SRAMS</span>
        </div>

        <nav className="sidebar-nav" aria-label="Admin navigation">
          <div className="nav-section">
            <p className="nav-section-label">Overview</p>
            <a href="/admin/dashboard" className="nav-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Dashboard
            </a>
          </div>
          <div className="nav-section">
            <p className="nav-section-label">Academic</p>
            <a href="/admin/students" className="nav-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Students
            </a>
            <a href="/admin/registrations" className="nav-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Registrations
            </a>
            <a href="/admin/enrollments" className="nav-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Enrollments
            </a>
          </div>
          <div className="nav-section">
            <p className="nav-section-label">Finance</p>
            <a href="/admin/finance/fee-schedules" className="nav-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Fee Schedules
            </a>
            <a href="/admin/finance/booklets" className="nav-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
              OR Booklets
            </a>
            <a href="/admin/assessments" className="nav-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Assessments
            </a>
          </div>
          <div className="nav-section">
            <p className="nav-section-label">System</p>
            <a href="/admin/users" className="nav-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Users
            </a>
            <a href="/admin/school-years" className="nav-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              School Years
            </a>
          </div>
        </nav>

        {/* User info + Logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar" aria-hidden="true">A</div>
            <div>
              <p className="user-name">Admin</p>
              <p className="user-role">{ROLE_LABELS[session.role as Role]}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              id="logout-btn"
              type="submit"
              className="logout-btn"
              title="Sign out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="admin-main">
        {children}
      </main>

      <style>{`
        .admin-shell {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background: var(--color-surface-2);
        }
        .sidebar {
          width: 220px;
          flex-shrink: 0;
          background: var(--color-surface);
          border-right: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 1rem 1rem 0.75rem;
          border-bottom: 1px solid var(--color-border);
        }
        .sidebar-brand-text {
          font-weight: 800;
          font-size: 1rem;
          color: var(--color-primary);
          letter-spacing: 0.05em;
        }
        .sidebar-nav {
          flex: 1;
          padding: 0.75rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }
        .nav-section { padding: 0.5rem 0; }
        .nav-section-label {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-subtle);
          padding: 0 1rem;
          margin-bottom: 0.25rem;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.4rem 1rem;
          font-size: 0.825rem;
          font-weight: 500;
          color: var(--color-text-2);
          text-decoration: none;
          border-radius: 0;
          transition: background 0.1s, color 0.1s;
        }
        .nav-link:hover {
          background: var(--color-surface-3);
          color: var(--color-primary);
        }
        .nav-link.active {
          background: var(--color-primary-50);
          color: var(--color-primary);
          font-weight: 600;
          border-right: 2px solid var(--color-primary);
        }
        .sidebar-footer {
          border-top: 1px solid var(--color-border);
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .sidebar-user {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 0;
        }
        .user-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--color-primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .user-name {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .user-role {
          font-size: 0.7rem;
          color: var(--color-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .logout-btn {
          background: none;
          border: none;
          padding: 0.375rem;
          cursor: pointer;
          color: var(--color-text-muted);
          border-radius: var(--radius);
          transition: background 0.1s, color 0.1s;
          flex-shrink: 0;
        }
        .logout-btn:hover {
          background: var(--color-surface-3);
          color: var(--color-error);
        }
        .admin-main {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem 2rem;
        }
      `}</style>
    </div>
  );
}
