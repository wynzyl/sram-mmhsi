import { Suspense } from "react";
import { requirePortalSession } from "@/lib/auth/session";
import { PortalPaymentsView } from "@/features/payments/components/PortalPaymentsView";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata = { title: "My Payments" };

/**
 * Instant navigation - full payments skeleton shown while data loads.
 */
export default function PortalPaymentsPageWrapper() {
  return (
    <Suspense fallback={<PaymentsSkeleton />}>
      <PortalPaymentsContent />
    </Suspense>
  );
}

function PaymentsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-4 sm:px-6 sm:py-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-3 w-28 mb-2" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>

      {/* Payments list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between px-6 py-4">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Thin server shell: enforces auth + portal session, then renders the client view.
 * Payment history is fetched client-side via `usePortalPayments` (TanStack Query)
 * Always fresh, never cached server-side.
 * The API route uses session.studentId directly for secure data access.
 */
async function PortalPaymentsContent() {
  await requirePortalSession();

  return <PortalPaymentsView />;
}
