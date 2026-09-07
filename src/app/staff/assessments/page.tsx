import { Suspense } from "react";
import type { Metadata } from "next";
import { AssessmentsIndexPage } from "@/app/page-templates/assessments/assessments-index-page";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Assessments",
  description: "Create assessments for pending enrollments and view billing ledgers.",
};

/**
 * Instant navigation - full assessments directory skeleton shown while data loads.
 */
export default function StaffAssessmentsListPage(props: {
  searchParams: Promise<{ view?: string }>;
}) {
  return (
    <Suspense fallback={<AssessmentsSkeleton />}>
      <AssessmentsIndexPage
        searchParams={props.searchParams}
        assessmentsBasePath="/staff/assessments"
        deniedRedirect="/staff/dashboard"
      />
    </Suspense>
  );
}

function AssessmentsSkeleton() {
  return (
    <div className="page-container space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
