import { redirect } from "next/navigation";
import type { StudentDirectoryBasePath } from "@/lib/utils/student-directory-href";
import {
  StudentDirectoryView,
  type StudentDirectoryQuickLink,
} from "@/features/students/components/StudentDirectoryView";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";

/**
 * Thin server shell: enforces auth + read permission, then renders the
 * client directory view. All student data is fetched client-side via
 * `useStudents` (TanStack Query) so the active school year stays live.
 *
 * `searchParams` is accepted for route compatibility but read client-side
 * from the URL via `useSearchParams`.
 */
export async function InternalStudentDirectoryPage(props: {
  searchParams: Promise<{ q?: string; page?: string; schoolYearId?: string; gradeLevelId?: string }>;
  basePath: StudentDirectoryBasePath;
  registerHref: string;
  deniedRedirect: string;
  title: string;
  quickLinks: StudentDirectoryQuickLink[];
}) {
  const { basePath, registerHref, deniedRedirect, title, quickLinks } = props;

  const session = await requireSession();
  if (!hasPermission(session.role, "students:read")) redirect(deniedRedirect);

  return (
    <StudentDirectoryView
      basePath={basePath}
      registerHref={registerHref}
      title={title}
      quickLinks={quickLinks}
    />
  );
}
