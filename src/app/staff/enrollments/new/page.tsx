import { Suspense } from "react";
import type { Metadata } from "next";
import { InternalNewEnrollmentPage } from "@/app/page-templates/enrollments/new-enrollment-page";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";
import { requireSession } from "@/lib/auth/session";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = { title: "New Enrollment" };

/**
 * Instant navigation - full enrollment wizard skeleton shown while data loads.
 */
export default function StaffNewEnrollmentPage(props: {
  searchParams: Promise<{ studentId?: string; registrationId?: string }>;
}) {
  return (
    <Suspense fallback={<NewEnrollmentSkeleton />}>
      <NewEnrollmentContent searchParams={props.searchParams} />
    </Suspense>
  );
}

function NewEnrollmentSkeleton() {
  return (
    <div className="page-container">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1.5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-4 w-28" />
      </div>
      {/* Header */}
      <header className="mb-8 max-w-3xl">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-56 mt-2" />
        <Skeleton className="h-4 w-full max-w-2xl mt-3" />
        <Skeleton className="h-4 w-3/4 max-w-xl mt-1" />
      </header>
      {/* Form */}
      <div className="max-w-2xl space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-3">
            <div>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-28 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}

async function NewEnrollmentContent(props: {
  searchParams: Promise<{ studentId?: string; registrationId?: string }>;
}) {
  const session = await requireSession();
  const deniedRedirect = staffHomePathForRole(session.role as Role);

  return (
    <InternalNewEnrollmentPage
      searchParams={props.searchParams}
      enrollmentsListPath="/staff/enrollments"
      deniedRedirect={deniedRedirect}
    />
  );
}
