import { Suspense } from "react";
import { requireSession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import type { Role } from "@/lib/constants/roles";
import { ROLES, normalizeRole } from "@/lib/constants/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const role = normalizeRole(session.role);

  if (role !== ROLES.SUPER_ADMIN) {
    redirect("/login");
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="app-shell">
      <Suspense
        fallback={<aside className="sidebar" style={{ width: 220, flexShrink: 0 }} aria-hidden />}
      >
        <Sidebar role={user.role as Role} username={user.username} email={user.email} />
      </Suspense>
      <main className="app-main">{children}</main>
      <style>{`
        .app-shell {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background: var(--color-surface-2);
        }
        .app-main {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem 2rem;
        }
      `}</style>
    </div>
  );
}
