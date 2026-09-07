import { Suspense } from "react";
import type { Metadata } from "next";
import { InternalNewStudentRegistrationPage } from "@/app/page-templates/registrations/new-student-registration-page";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";
import { requireSession } from "@/lib/auth/session";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Register New Student",
};

/**
 * Instant navigation - full registration form skeleton shown while data loads.
 */
export default function StaffNewStudentPage(props: {
  searchParams: Promise<{ intent?: string }>;
}) {
  return (
    <Suspense fallback={<NewStudentSkeleton />}>
      <NewStudentContent searchParams={props.searchParams} />
    </Suspense>
  );
}

function NewStudentSkeleton() {
  return (
    <div className="page-container page-container-narrow space-y-8">
      {/* Header */}
      <header className="space-y-2 border-b border-border pb-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-3/4 max-w-xl" />
      </header>

      {/* Form wizard */}
      <div className="space-y-6">
        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              {i < 4 && <Skeleton className="h-0.5 w-12" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}

async function NewStudentContent(props: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const session = await requireSession();
  const deniedRedirect = staffHomePathForRole(session.role as Role);

  return (
    <InternalNewStudentRegistrationPage
      searchParams={props.searchParams}
      deniedRedirect={deniedRedirect}
      afterCreateStudentBasePath="/staff/students"
    />
  );
}
