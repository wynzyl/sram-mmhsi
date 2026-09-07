import { Suspense } from "react";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import { normalizeRole, ROLES } from "@/lib/constants/roles";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

/**
 * Instant navigation - minimal skeleton shown during redirect.
 */
export default function StaffDashboardPage() {
  return (
    <Suspense fallback={<RedirectSkeleton />}>
      <DashboardRedirectContent />
    </Suspense>
  );
}

function RedirectSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

/** Shared staff dashboard entry point redirects to role-specific staff homes. */
async function DashboardRedirectContent(): Promise<never> {
  const session = await requireSession();
  const role = normalizeRole(session.role);

  if (!role) {
    redirect("/login");
  }

  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
    redirect("/admin/dashboard");
  }

  redirect(staffHomePathForRole(role));
}
