import type { Metadata } from "next";
import { InternalAssessmentLedgerPage } from "@/app/page-templates/assessments/assessment-ledger-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Assessment Ledger",
};

export default async function StaffAssessmentLedgerPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <InternalAssessmentLedgerPage
      assessmentId={id}
      deniedRedirect="/staff/dashboard"
      studentRecordsBasePath="/staff/students"
    />
  );
}
