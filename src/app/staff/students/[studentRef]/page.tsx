import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { InternalStudentProfilePage } from "@/app/page-templates/students/student-profile-page";
import { getStudentByRef, resolveStudentRef } from "@/features/students/students.queries";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

interface PageProps {
  params: Promise<{ studentRef: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { studentRef } = await params;
  const student = await getStudentByRef(studentRef);
  if (!student) return { title: "Student Not Found" };
  return { title: `${student.lastName}, ${student.firstName} — ${student.referenceNumber}` };
}

/**
 * Instant navigation - full student profile skeleton shown while data loads.
 */
export default function StaffStudentProfilePageWrapper({ params }: PageProps) {
  return (
    <Suspense fallback={<StudentProfileSkeleton />}>
      <StudentProfileContent params={params} />
    </Suspense>
  );
}

function StudentProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Skeleton className="h-9 w-32" />

      {/* Profile header card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex gap-6">
          {/* Photo */}
          <Skeleton className="h-32 w-32 rounded-xl shrink-0" />
          {/* Info */}
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-32 mt-1" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-16 mb-1" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-20" />
      </div>

      {/* Content cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Skeleton className="h-5 w-28" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

async function StudentProfileContent({ params }: PageProps) {
  const { studentRef } = await params;
  const session = await requireSession();

  if (!hasPermission(session.role, "students:read")) {
    redirect(staffHomePathForRole(session.role as Role));
  }

  const studentId = await resolveStudentRef(studentRef);
  if (!studentId) {
    notFound();
  }

  return (
    <InternalStudentProfilePage studentId={studentId} backHref="/staff/registrations" />
  );
}
