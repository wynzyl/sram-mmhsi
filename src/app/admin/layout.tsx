import { Suspense } from "react";
import { requireSession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPaletteProvider } from "@/components/command-palette";
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
  if (!user) redirect("/login");

  return (
    <CommandPaletteProvider>
      <div className="app-shell">
        <Sidebar role={user.role as Role} username={user.username} />
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
    </CommandPaletteProvider>
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
          <aside className="sidebar" style={{ width: 220, flexShrink: 0 }} aria-hidden />
          <main className="app-main" style={{ flex: 1, overflow: "auto", padding: "1.5rem 2rem" }}>
            <div className="animate-pulse" style={{ height: "100%" }} />
          </main>
          <style>{`
            .app-shell {
              display: flex;
              height: 100vh;
              overflow: hidden;
              background: var(--color-surface-2);
            }
          `}</style>
        </div>
      }
    >
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
