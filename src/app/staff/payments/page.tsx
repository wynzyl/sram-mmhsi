import { Suspense } from "react";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import { CashierDashboardView } from "@/features/payments/components/CashierDashboardView";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

/**
 * Instant navigation - full cashier dashboard skeleton shown while data loads.
 */
export default function CashierQueuePage() {
  return (
    <Suspense fallback={<CashierDashboardSkeleton />}>
      <CashierDashboardContent />
    </Suspense>
  );
}

function CashierDashboardSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      {/* Queue table */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Thin server shell: enforces auth + read permission, then renders the client
 * cashier dashboard. Stats, queue, and recent collections are fetched client-side
 * via `useCashierQueue` (TanStack Query) — always-fresh financial data, polled
 * every 30s, never cached server-side.
 */
async function CashierDashboardContent() {
  const session = await requireSession();

  if (!hasPermission(session.role, "payments:read")) {
    redirect("/login");
  }

  return <CashierDashboardView />;
}
