import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getSchoolYears, getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { getAssessmentsList } from "@/features/assessments";
import { StudentLedgersView } from "@/features/student-ledgers";
import { SectionHeader } from "@/components/ui/editorial/SectionHeader";

const PAGE_SIZE = 25;

type SearchParams = {
  q?: string;
  schoolYearId?: string;
  page?: string;
};

type StudentLedgersPageProps = {
  searchParams: Promise<SearchParams>;
};

export async function StudentLedgersPage({ searchParams }: StudentLedgersPageProps) {
  const session = await requireSession();

  // Permission check - same as assessments
  if (!hasPermission(session.role, "assessments:read")) {
    redirect("/staff");
  }

  const params = await searchParams;
  const searchQuery = params.q ?? "";
  const schoolYearId = params.schoolYearId;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));

  // Fetch school years for filter dropdown
  const schoolYears = await getSchoolYears();
  const activeSchoolYear = await getActiveSchoolYear();

  // Fetch assessments with filters
  const assessments = await getAssessmentsList({
    page: currentPage,
    pageSize: PAGE_SIZE,
    searchQuery: searchQuery || undefined,
    schoolYearId: schoolYearId || undefined,
  });

  return (
    <div className="page-container space-y-6">
      <SectionHeader
        size="md"
        accent
        title="Student Ledger"
        subtitle="Search and view student assessment ledgers to track payments and outstanding balances."
      />

      <StudentLedgersView
        assessments={assessments}
        schoolYears={schoolYears}
        initialSearch={searchQuery}
        initialSchoolYearId={schoolYearId ?? ""}
        activeSchoolYearId={activeSchoolYear?.id ?? null}
      />
    </div>
  );
}
