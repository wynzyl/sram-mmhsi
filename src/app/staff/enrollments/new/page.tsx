import type { Metadata } from "next";
import { InternalNewEnrollmentPage } from "@/app/_internal/enrollments/new-enrollment-page";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New Enrollment" };

export default async function StaffNewEnrollmentPage(props: {
  searchParams: Promise<{ studentId?: string; registrationId?: string }>;
}) {
  const session = await requireSession();
  const deniedRedirect = staffHomePathForRole(session.role as Role);

  return (
    <InternalNewEnrollmentPage
      searchParams={props.searchParams}
      enrollmentsListPath="/staff/enrollments"
      deniedRedirect={deniedRedirect}
    />
  );
}
