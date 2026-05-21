import type { Metadata } from "next";
import { InternalEnrollmentDetailPage } from "@/app/page-templates/enrollments/enrollment-detail-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Enrollment Detail",
};

export default async function StaffEnrollmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <InternalEnrollmentDetailPage
      enrollmentId={id}
      deniedRedirect="/staff/dashboard"
      studentRecordsBasePath="/staff/students"
    />
  );
}
