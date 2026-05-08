import type { Metadata } from "next";
import { EnrollmentsIndexPage } from "@/app/_internal/enrollments/enrollments-index-page";

export const metadata: Metadata = {
  title: "Enrollments",
  description: "Manage student enrollments (staff).",
};

export default async function StaffEnrollmentsPage(props: {
  searchParams: Promise<{ status?: string; sy?: string }>;
}) {
  return (
    <EnrollmentsIndexPage
      searchParams={props.searchParams}
      deniedRedirect="/staff/dashboard"
    />
  );
}
