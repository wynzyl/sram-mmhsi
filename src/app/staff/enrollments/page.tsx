import type { Metadata } from "next";
import { Suspense } from "react";
import { EnrollmentQueuePage } from "@/app/page-templates/enrollments/enrollments-queue-page";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Enrollments",
  description: "Manage student enrollments (staff).",
};

/**
 * Staff Enrollments Page - Queue-based enrollment workflow
 * Instant navigation - full page skeleton shown while data loads.
 */
export default function StaffEnrollmentsPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense fallback={<EnrollmentQueueSkeleton />}>
      <EnrollmentQueuePage
        searchParams={props.searchParams}
        deniedRedirect="/staff/dashboard"
        enrollmentsBasePath="/staff/enrollments"
        staffBasePath="/staff"
      />
    </Suspense>
  );
}

function EnrollmentQueueSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      {/* Header skeleton */}
      <div className="space-y-1">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-44" />
      </div>

      {/* Card skeleton */}
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {/* Header controls */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        {/* Tab navigation skeleton */}
        <div className="flex gap-1 border-b border-border px-4 py-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-28 rounded" />
          ))}
        </div>

        {/* Table rows */}
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
