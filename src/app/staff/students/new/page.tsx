import type { Metadata } from "next";
import { InternalNewStudentRegistrationPage } from "@/app/_internal/registrations/new-student-registration-page";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Register New Student",
};

export default async function StaffNewStudentPage(props: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const session = await requireSession();
  const deniedRedirect = staffHomePathForRole(session.role as Role);

  return (
    <InternalNewStudentRegistrationPage
      searchParams={props.searchParams}
      deniedRedirect={deniedRedirect}
      afterCreateStudentBasePath="/staff/students"
    />
  );
}
