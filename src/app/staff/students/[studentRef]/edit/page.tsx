import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { InternalEditStudentPage } from "@/app/page-templates/students/edit-student-page";
import { getStudentByRef, resolveStudentRef } from "@/features/students/students.queries";
import { Skeleton } from "@/components/ui/skeleton";
import { studentDetailUrl } from "@/lib/utils/student-routes";

// Instant navigation enabled - uses Suspense for streaming

interface PageProps {
  params: Promise<{ studentRef: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { studentRef } = await params;
  const student = await getStudentByRef(studentRef);
  if (!student) return { title: "Student Not Found" };
  return { title: `Edit ${student.lastName}, ${student.firstName}` };
}

/**
 * Instant navigation - full edit student skeleton shown while data loads.
 */
export default function StaffEditStudentPageWrapper({ params }: PageProps) {
  return (
    <Suspense fallback={<EditStudentSkeleton />}>
      <EditStudentContent params={params} />
    </Suspense>
  );
}

function EditStudentSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex gap-6">
          <Skeleton className="h-24 w-24 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Form sections */}
      <div className="space-y-6">
        {/* Personal Information */}
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
        </div>

        {/* Contact Information */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-44" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Guardians */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded border border-border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit buttons */}
        <div className="flex justify-end gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}

async function EditStudentContent({ params }: PageProps) {
  const { studentRef } = await params;
  const session = await requireSession();

  const studentId = await resolveStudentRef(studentRef);
  if (!studentId) {
    notFound();
  }

  if (!hasPermission(session.role, "students:update")) {
    redirect(studentDetailUrl({ referenceNumber: studentRef }));
  }

  return <InternalEditStudentPage studentId={studentId} studentsBasePrefix="/staff/students" />;
}
