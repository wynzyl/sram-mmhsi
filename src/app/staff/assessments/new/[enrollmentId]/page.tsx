import type { Metadata } from "next";
import { InternalNewAssessmentForEnrollmentPage } from "@/app/_internal/assessments/new-assessment-for-enrollment-page";

export const metadata: Metadata = { title: "Fee assessment" };

interface PageProps {
  params: Promise<{ enrollmentId: string }>;
}

export default async function StaffNewAssessmentForEnrollmentPage({ params }: PageProps) {
  const { enrollmentId } = await params;
  return (
    <InternalNewAssessmentForEnrollmentPage
      enrollmentId={enrollmentId}
      assessmentsBasePath="/staff/assessments"
    />
  );
}
