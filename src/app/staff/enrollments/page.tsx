import type { Metadata } from "next";
import { EnrollmentQueuePage } from "@/app/page-templates/enrollments/enrollments-queue-page";

export const metadata: Metadata = {
  title: "Enrollments",
  description: "Manage student enrollments (staff).",
};

/**
 * Staff Enrollments Page - Queue-based enrollment workflow
 *
 * PHASE 1: Switched to list-first enrollment queue system.
 * Legacy form-first approach available at /staff/enrollments/new for manual entry.
 */
export default async function StaffEnrollmentsPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <EnrollmentQueuePage
      searchParams={props.searchParams}
      deniedRedirect="/staff/dashboard"
      enrollmentsBasePath="/staff/enrollments"
      staffBasePath="/staff"
    />
  );
}
