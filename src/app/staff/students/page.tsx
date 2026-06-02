import type { Metadata } from "next";
import { InternalStudentDirectoryPage } from "@/app/page-templates/students/students-directory-page";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Master List",
  description: "Enrolled students master list (staff).",
};

export default async function StaffStudentsMasterListPage(props: {
  searchParams: Promise<{ q?: string; page?: string; schoolYearId?: string; gradeLevelId?: string }>;
}) {
  const session = await requireSession();
  const deniedRedirect = staffHomePathForRole(session.role as Role);

  return (
    <InternalStudentDirectoryPage
      searchParams={props.searchParams}
      basePath="/staff/students"
      registerHref="/staff/register"
      deniedRedirect={deniedRedirect}
      title="Student Directory"
    />
  );
}
