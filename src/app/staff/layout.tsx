import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/constants/roles";
import type { Role } from "@/lib/constants/roles";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  // Ensure only staff roles can access the staff portal
  if (!STAFF_ROLES.includes(session.role)) {
    redirect("/login");
  }

  return (
    <div className="staff-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="8" fill="var(--color-primary)" />
            <path d="M10 28 L20 12 L30 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 22 H26" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="sidebar-brand-text">SRAMS Staff</span>
        </div>

        <nav className="sidebar-nav" aria-label="Staff navigation">
          {session.role === "teacher" && (
            <div className="nav-section">
              <p className="nav-section-label">Academics</p>
              <a href="/staff/grades" className="nav-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                My Classes
              </a>
            </div>
          )}
          {/* We can add other roles (registrar, finance, etc.) here if needed */}
        </nav>

        {/* User info + Logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar" aria-hidden="true">
              {session.role.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="user-name">Staff User</p>
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
      <main className="staff-main">
        {children}
      </main>

      <style>{`
        .staff-shell {
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
        .staff-main {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem 2rem;
        }
      `}</style>
    </div>
  );
}
