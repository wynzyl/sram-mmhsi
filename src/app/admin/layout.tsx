import { Suspense } from "react";
import { requireSession, INVALID_SESSION_REDIRECT } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppFooter } from "@/components/layout/AppFooter";
import { CommandPaletteProvider } from "@/components/command-palette";
import { ActiveSchoolYearProvider } from "@/components/providers/ActiveSchoolYearProvider";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import type { Role } from "@/lib/constants/roles";
import { ROLES, normalizeRole } from "@/lib/constants/roles";

// Authenticated layout content - wrapped in Suspense at the page level
async function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const role = normalizeRole(session.role);

  if (role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN) {
    redirect("/login");
  }

  const user = await getCurrentUser();
  if (!user) redirect(INVALID_SESSION_REDIRECT);

  const activeSchoolYear = await getActiveSchoolYear();

  return (
    <ActiveSchoolYearProvider activeSchoolYearId={activeSchoolYear?.id ?? null}>
      <CommandPaletteProvider>
        <div className="app-shell">
          <AppHeader
            username={user.username}
            role={user.role as Role}
            schoolYear={activeSchoolYear?.label}
          />
          <div className="app-body">
            <Sidebar role={user.role as Role} />
            <main className="app-main">
              <div className="app-content">{children}</div>
              <AppFooter schoolYear={activeSchoolYear?.label} />
            </main>
          </div>
        </div>
        <style>{`
          .app-shell {
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
            background: var(--muted);
          }
          .app-body {
            display: flex;
            flex: 1;
            overflow: hidden;
          }
          .app-main {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            background-color: var(--background);
          }
          .app-content {
            flex: 1;
            padding: 1.5rem 2rem;
          }
        `}</style>
      </CommandPaletteProvider>
    </ActiveSchoolYearProvider>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Wrap the entire authenticated layout in Suspense to defer to request time
  return (
    <Suspense
      fallback={
        <div className="app-shell">
          <div
            className="app-header-skeleton"
            style={{ height: 64, flexShrink: 0, background: "var(--card)", borderBottom: "1px solid var(--border)" }}
            aria-hidden
          />
          <div className="app-body" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <aside className="sidebar" style={{ width: 220, flexShrink: 0 }} aria-hidden />
            <main
              className="app-main"
              style={{ flex: 1, overflow: "auto", padding: "1.5rem 2rem", backgroundColor: "var(--background)" }}
            >
              <div className="animate-pulse" style={{ height: "100%" }} />
            </main>
          </div>
          <style>{`
            .app-shell {
              display: flex;
              flex-direction: column;
              height: 100vh;
              overflow: hidden;
              background: var(--muted);
            }
          `}</style>
        </div>
      }
    >
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
