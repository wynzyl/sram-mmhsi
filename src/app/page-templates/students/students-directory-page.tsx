import { redirect } from "next/navigation";
import { parseUuidSearchParam } from "@/lib/utils/query-params";
import { studentDirectoryListHref } from "@/lib/utils/student-directory-href";
import type { StudentDirectoryBasePath } from "@/lib/utils/student-directory-href";
import {
  fetchStudentDirectoryPage,
  fetchActiveSchoolYearId,
  getStudentDirectoryEmptyMessage,
} from "@/features/students/students.queries";
import {
  StudentDirectoryView,
  type StudentDirectoryQuickLink,
} from "@/features/students/components/StudentDirectoryView";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";

export async function InternalStudentDirectoryPage(props: {
  searchParams: Promise<{ q?: string; page?: string; schoolYearId?: string; gradeLevelId?: string }>;
  basePath: StudentDirectoryBasePath;
  registerHref: string;
  deniedRedirect: string;
  title: string;
  quickLinks: StudentDirectoryQuickLink[];
}) {
  try {
    const { searchParams, basePath, registerHref, deniedRedirect, title, quickLinks } = props;
    const session = await requireSession();
    if (!hasPermission(session.role, "students:read")) redirect(deniedRedirect);

    const {
      q = "",
      page = "1",
      schoolYearId: schoolYearIdRaw,
      gradeLevelId: gradeLevelIdRaw,
    } = await searchParams;
    const gradeLevelId = parseUuidSearchParam(gradeLevelIdRaw);
    let schoolYearId = parseUuidSearchParam(schoolYearIdRaw);

    // Default to the active school year when none is specified in the URL.
    // Use the active year directly instead of redirecting to avoid client-side navigation issues.
    if (!schoolYearId) {
      const activeId = await fetchActiveSchoolYearId();
      if (activeId) {
        schoolYearId = activeId;
      }
    }

    const currentPageRaw = Math.max(1, parseInt(page, 10) || 1);

    const data = await fetchStudentDirectoryPage({
      q,
      page: currentPageRaw,
      schoolYearId,
      gradeLevelId,
    });

    if (data.totalCount > 0 && currentPageRaw > data.totalPages) {
      redirect(
        studentDirectoryListHref(basePath, {
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
        basePath={basePath}
        registerHref={registerHref}
        canCreate={canCreate}
        title={title}
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
        quickLinks={quickLinks}
      />
    );
  } catch (error) {
    // Next.js redirect() throws a special error - don't log these
    const isRedirect =
      error instanceof Error &&
      "digest" in error &&
      typeof (error as { digest?: string }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT");

    if (!isRedirect) {
      console.error("[students-directory-page] Render error:", error);
    }
    throw error; // Re-throw to let Next.js handle redirects or trigger error boundary
  }
}
