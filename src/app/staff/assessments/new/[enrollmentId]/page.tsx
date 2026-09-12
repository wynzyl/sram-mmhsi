import type { Metadata } from "next";
import { Suspense } from "react";
import { InternalNewAssessmentForEnrollmentPage } from "@/app/page-templates/assessments/new-assessment-for-enrollment-page";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Fee assessment" };

interface PageProps {
  params: Promise<{ enrollmentId: string }>;
}

/**
 * Instant navigation - sync shell with async content inside Suspense.
 */
export default function StaffNewAssessmentForEnrollmentPage({ params }: PageProps) {
  return (
    <Suspense fallback={<NewAssessmentSkeleton />}>
      <NewAssessmentContent params={params} />
    </Suspense>
  );
}

function NewAssessmentSkeleton() {
  return (
    <div className="page-container space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

async function NewAssessmentContent({ params }: PageProps) {
  const { enrollmentId } = await params;
  return (
    <InternalNewAssessmentForEnrollmentPage
      enrollmentId={enrollmentId}
      assessmentsBasePath="/staff/assessments"
    />
  );
}
