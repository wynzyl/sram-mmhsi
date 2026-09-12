import type { Metadata } from "next";
import { Suspense } from "react";
import { InternalEnrollmentDetailPage } from "@/app/page-templates/enrollments/enrollment-detail-page";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Enrollment Detail",
};

/**
 * Instant navigation - sync shell with async content inside Suspense.
 */
export default function StaffEnrollmentDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<EnrollmentDetailSkeleton />}>
      <EnrollmentDetailContent params={params} />
    </Suspense>
  );
}

async function EnrollmentDetailContent({ params }: PageProps) {
  const { id } = await params;

  return (
    <InternalEnrollmentDetailPage
      enrollmentId={id}
      deniedRedirect="/staff/dashboard"
      studentRecordsBasePath="/staff/students"
    />
  );
}

function EnrollmentDetailSkeleton() {
  return (
    <div className="page-container space-y-6 p-6">
      {/* Back link skeleton */}
      <Skeleton className="h-4 w-36" />

      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Info cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        ))}
      </div>

      {/* Assessment section */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>

      {/* Discounts section */}
      <div className="rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-5 w-28 mb-4" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
