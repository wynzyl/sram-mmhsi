import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { AssessmentsDirectoryView } from "@/features/assessments/components/AssessmentsDirectoryView";

/**
 * Thin server shell: enforces auth + read permission, then renders the client
 * directory view. All assessment data is fetched client-side via `useAssessments`
 * (TanStack Query) so financial rows stay always-fresh and never cached server-side.
 *
 * `searchParams` is accepted for route compatibility but read client-side from
 * the URL via `useSearchParams`.
 */
export async function AssessmentsIndexPage(props: {
  searchParams: Promise<{ view?: string; page?: string }>;
  assessmentsBasePath: "/staff/assessments";
  deniedRedirect: string;
}) {
  const { assessmentsBasePath, deniedRedirect } = props;
  const session = await requireSession();

  if (!hasPermission(session.role, "assessments:read")) {
    redirect(deniedRedirect);
  }

  return <AssessmentsDirectoryView basePath={assessmentsBasePath} />;
}
