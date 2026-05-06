import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { parseUuidSearchParam } from "@/lib/utils/query-params";
import { studentDirectoryListHref } from "@/lib/utils/student-directory-href";
import {
  fetchStudentDirectoryPage,
  getStudentDirectoryEmptyMessage,
} from "@/lib/queries/students-directory";
import { StudentDirectoryView } from "@/components/students/StudentDirectoryView";

export const metadata: Metadata = {
  title: "Students",
  description: "Manage student records in SRAMS.",
};

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; schoolYearId?: string; gradeLevelId?: string }>;
}

export default async function StudentsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "students:read")) redirect("/admin/dashboard");

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
      studentDirectoryListHref("/admin/students", {
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
      basePath="/admin/students"
      registerHref="/admin/students/new"
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
          href: "/admin/students/new",
          label: "New registration",
          description: "Register a student and start enrollment.",
          icon: "register",
        },
        {
          href: "/admin/assessments",
          label: "Assessments",
          description: "Review fee assessments and balances.",
          icon: "assessments",
        },
        {
          href: "/admin/school-years",
          label: "School years",
          description: "Terms, schedules, and academic calendar context.",
          icon: "calendar",
        },
      ]}
    />
  );
}
