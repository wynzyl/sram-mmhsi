import { Suspense } from "react";
import { requireSession, INVALID_SESSION_REDIRECT } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
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

  // Parallelize independent queries after session validation
  const [user, activeSchoolYear] = await Promise.all([
    getCurrentUser(),
    getActiveSchoolYear(),
  ]);
  if (!user) redirect(INVALID_SESSION_REDIRECT);

  return (
    <ActiveSchoolYearProvider activeSchoolYearId={activeSchoolYear?.id ?? null}>
      <CommandPaletteProvider>
        <SidebarProvider defaultOpen={true}>
          <AppSidebar role={user.role as Role} />
          <SidebarInset>
            <AppHeader
              username={user.username}
              role={user.role as Role}
              schoolYear={activeSchoolYear?.label}
            />
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">{children}</div>
              <AppFooter schoolYear={activeSchoolYear?.label} />
            </div>
          </SidebarInset>
        </SidebarProvider>
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
        <div className="flex min-h-svh">
          <div
            className="hidden md:block shrink-0 bg-sidebar border-r border-border"
            style={{ width: "var(--sidebar-width, 16rem)" }}
            aria-hidden
          />
          <div className="flex-1 flex flex-col">
            <div
              className="h-16 shrink-0 bg-sidebar border-b border-border"
              aria-hidden
            />
            <main className="flex-1 p-6 bg-background">
              <div className="animate-pulse h-full" />
            </main>
          </div>
        </div>
      }
    >
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
