import type { Metadata } from "next";
import { AssessmentsIndexPage } from "@/app/page-templates/assessments/assessments-index-page";

export const metadata: Metadata = {
  title: "Assessments",
  description: "Create assessments for pending enrollments and view billing ledgers.",
};

export default async function StaffAssessmentsListPage(props: {
  searchParams: Promise<{ view?: string }>;
}) {
  return (
    <AssessmentsIndexPage
      searchParams={props.searchParams}
      assessmentsBasePath="/staff/assessments"
      deniedRedirect="/staff/dashboard"
    />
  );
}
