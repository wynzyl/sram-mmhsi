import { Suspense } from "react";
import type { Metadata } from "next";
import { InternalStudentDirectoryPage } from "@/app/page-templates/students/students-directory-page";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";
import { requireSession } from "@/lib/auth/session";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Master List",
  description: "Enrolled students master list (staff).",
};

/**
 * Instant navigation - full student directory skeleton shown while data loads.
 */
export default function StaffStudentsMasterListPage(props: {
  searchParams: Promise<{ q?: string; page?: string; schoolYearId?: string; gradeLevelId?: string }>;
}) {
  return (
    <Suspense fallback={<StudentDirectorySkeleton />}>
      <StudentDirectoryContent searchParams={props.searchParams} />
    </Suspense>
  );
}

function StudentDirectorySkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function StudentDirectoryContent(props: {
  searchParams: Promise<{ q?: string; page?: string; schoolYearId?: string; gradeLevelId?: string }>;
}) {
  const session = await requireSession();
  const deniedRedirect = staffHomePathForRole(session.role as Role);

  return (
    <InternalStudentDirectoryPage
      searchParams={props.searchParams}
      basePath="/staff/students"
      registerHref="/staff/register"
      deniedRedirect={deniedRedirect}
      title="Student Directory"
    />
  );
}
