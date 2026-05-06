import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { staffHomePathForRole } from "@/lib/utils/staff-home";
import type { Role } from "@/lib/constants/roles";
import { parseUuidSearchParam } from "@/lib/utils/query-params";
import { studentDirectoryListHref } from "@/lib/utils/student-directory-href";
import {
  fetchStudentDirectoryPage,
  getStudentDirectoryEmptyMessage,
} from "@/lib/queries/students-directory";
import { StudentDirectoryView } from "@/components/students/StudentDirectoryView";

export const metadata: Metadata = {
  title: "Master List",
  description: "Enrolled students master list (staff).",
};

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; schoolYearId?: string; gradeLevelId?: string }>;
}

export default async function StaffStudentsMasterListPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "students:read")) {
    redirect(staffHomePathForRole(session.role as Role));
  }

  const {
    q = "",
    page = "1",
    schoolYearId: schoolYearIdRaw,
    gradeLevelId: gradeLevelIdRaw,
  } = await searchParams;
  const schoolYearId = parseUuidSearchParam(schoolYearIdRaw);
  const gradeLevelId = parseUuidSearchParam(gradeLevelIdRaw);

  const currentPageRaw = Math.max(1, parseInt(page, 10) || 1);

  const data = await fetchStudentDirectoryPage({
    q,
    page: currentPageRaw,
    schoolYearId,
    gradeLevelId,
  });

  if (data.totalCount > 0 && currentPageRaw > data.totalPages) {
    redirect(
      studentDirectoryListHref("/staff/students", {
        q: q.trim() || undefined,
        schoolYearId,
        gradeLevelId,
        page: data.totalPages,
      })
    );
  }

  const canCreate = hasPermission(session.role, "students:create");
  const emptyMessage = getStudentDirectoryEmptyMessage(q, schoolYearId, gradeLevelId);

  return (
    <StudentDirectoryView
      basePath="/staff/students"
      registerHref="/staff/register"
      canCreate={canCreate}
      title="Student Directory"
      q={q}
      schoolYearId={schoolYearId}
      gradeLevelId={gradeLevelId}
      schoolYearOptions={data.schoolYearOptions}
      gradeLevelOptions={data.gradeLevelOptions}
      rows={data.rows}
      emptyMessage={emptyMessage}
      totalCount={data.totalCount}
      totalPages={data.totalPages}
      currentPage={data.currentPage}
      quickLinks={[
        {
          href: "/staff/register",
          label: "New registration",
          description: "Registrar intake and new student flow.",
          icon: "register",
        },
        {
          href: "/staff/assessments",
          label: "Assessments",
          description: "Fee assessments and billing review.",
          icon: "assessments",
        },
        {
          href: "/staff/enrollments",
          label: "Enrollments",
          description: "Enrollment queue and section placement.",
          icon: "calendar",
        },
      ]}
    />
  );
}
