import type { Metadata } from "next";
import { Suspense } from "react";
import { RegistrationQueuePage } from "@/app/page-templates/registrations/registration-queue-page";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Registrations",
  description: "View student registrations (staff).",
};

/**
 * Instant navigation - full page skeleton shown while data loads.
 */
export default function StaffRegistrationsPage(props: {
  searchParams: Promise<{ page?: string; schoolYearId?: string }>;
}) {
  return (
    <Suspense fallback={<RegistrationQueueSkeleton />}>
      <RegistrationQueuePage
        searchParams={props.searchParams}
        pathPrefix="/staff"
        deniedRedirect="/staff/dashboard"
      />
    </Suspense>
  );
}

function RegistrationQueueSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      {/* Header skeleton */}
      <div className="space-y-1">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Card skeleton */}
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
