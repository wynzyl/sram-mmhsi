import { Suspense } from "react";
import { requireSession, INVALID_SESSION_REDIRECT, getPortalUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { PortalFooter } from "@/components/layout/PortalFooter";
import { Skeleton } from "@/components/ui/skeleton";
import { ActiveSchoolYearProvider } from "@/components/providers/ActiveSchoolYearProvider";
import { IdleLogoutProvider } from "@/components/providers/IdleLogoutProvider";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import type { Role } from "@/lib/constants/roles";

// Authenticated layout content - wrapped in Suspense at the page level
async function PortalLayoutContent({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  // Portal layout only accepts portal sessions (accountSource === "portal")
  if (session.accountSource !== "portal") {
    redirect("/login");
  }

  // Parallelize independent queries after session validation
  const [user, activeSchoolYear] = await Promise.all([
    getPortalUser(),
    getActiveSchoolYear(),
  ]);
  if (!user) redirect(INVALID_SESSION_REDIRECT);

  // For portal users, display name is student's name
  const displayName = `${user.student.firstName} ${user.student.lastName}`;

  return (
    <ActiveSchoolYearProvider activeSchoolYearId={activeSchoolYear?.id ?? null}>
      <IdleLogoutProvider>
        <SidebarProvider defaultOpen>
          <AppSidebar role={user.role as Role} />
          <SidebarInset>
            <PortalHeader
              displayName={displayName}
              schoolYear={activeSchoolYear?.label}
              role={user.role as Role}
            />
            {/* Page padding is owned by PortalPage. flex-1 on the content
                column keeps the footer at the bottom on short pages. */}
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1">{children}</div>
              <PortalFooter schoolYear={activeSchoolYear?.label} />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </IdleLogoutProvider>
    </ActiveSchoolYearProvider>
  );
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Wrap the entire authenticated layout in Suspense to defer to request time
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh">
          {/* Sidebar placeholder */}
          <div
            className="hidden md:block shrink-0 bg-sidebar border-r border-border"
            style={{ width: "var(--sidebar-width, 16rem)" }}
            aria-hidden
          />
          <div className="flex-1 flex flex-col">
            {/* Header placeholder */}
            <div
              className="h-14 sm:h-16 shrink-0 bg-sidebar border-b border-border flex items-center px-4 gap-3"
              aria-hidden
            >
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
            {/* Content placeholder */}
            <main className="flex-1 bg-background">
              <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-4 sm:px-6 sm:py-6">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-56" />
                  <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-40 w-full rounded-lg" />
              </div>
            </main>
          </div>
        </div>
      }
    >
      <PortalLayoutContent>{children}</PortalLayoutContent>
    </Suspense>
  );
}
