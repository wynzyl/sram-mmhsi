import { requireSession } from "@/lib/auth/session";
import { notFound, redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import Link from "next/link";
import {
  getSectionDetails,
  isAdviserForSection,
  getStudentsInSection,
  getSubjectsForGradeLevel,
  getGradingSystemType,
  getGradeSheetForPeriod,
  getPeriodsCompletionStatus,
} from "@/features/academics/grades/grades.queries";
import { AdviserGradeEntryGrid } from "@/features/academics/grades/components/AdviserGradeEntryGrid";
import { GradingPeriodSelector } from "@/features/academics/grades/components/GradingPeriodSelector";
import { QUARTERLY_PERIODS, TRIMESTER_PERIODS } from "@/lib/constants/grading-periods";

interface PageProps {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{ period?: string }>;
}

export default async function AdviserGradeEntryPage({
  params,
  searchParams,
}: PageProps) {
  const session = await requireSession();
  const { sectionId } = await params;
  const { period } = await searchParams;

  // Verify permission
  if (!hasPermission(session.role, "grades:encode")) {
    redirect("/staff/grades");
  }

  // Get section details
  const section = await getSectionDetails(sectionId);
  if (!section) {
    notFound();
  }

  // Verify user is adviser for this section (unless admin)
  if (session.role === "teacher") {
    const isAdviser = await isAdviserForSection(
      session.userId,
      sectionId,
      section.schoolYearId
    );
    if (!isAdviser) {
      redirect("/staff/grades");
    }
  }

  // Fetch students, subjects, and grading system type in parallel
  const [students, subjects, gradingSystemType] = await Promise.all([
    getStudentsInSection(sectionId, section.schoolYearId),
    getSubjectsForGradeLevel(section.gradeLevelId, section.schoolYearId),
    getGradingSystemType(section.schoolYearId),
  ]);

  // Default to first period based on grading system type
  const periods = gradingSystemType === "trimester" ? TRIMESTER_PERIODS : QUARTERLY_PERIODS;
  const defaultPeriod = periods[0];
  const selectedPeriod = period || defaultPeriod;

  // Fetch grade sheet data and completion status in parallel
  const [gradeSheetData, completionStatus] = await Promise.all([
    getGradeSheetForPeriod(sectionId, section.schoolYearId, selectedPeriod),
    getPeriodsCompletionStatus(
      sectionId,
      section.schoolYearId,
      periods,
      students.length,
      subjects.length
    ),
  ]);

  // Convert completion status Map to a serializable object
  const completionStatusObj = Object.fromEntries(completionStatus);

  // Check if the selected period is allowed (previous period must be complete)
  const periodIndex = (periods as readonly string[]).indexOf(selectedPeriod);
  const canEditSelectedPeriod = periodIndex === 0 ||
    (periodIndex > 0 && completionStatus.get(periods[periodIndex - 1])?.isComplete);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link
                href="/staff/grades"
                className="hover:text-primary-600 transition-colors"
              >
                Grades
              </Link>
              <span>/</span>
              <span className="text-gray-900">Section {section.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Section {section.name} - Grade Entry
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-medium text-gray-900">
                {section.gradeLevelName}
              </span>{" "}
              |{" "}
              <span className="font-medium text-gray-900">
                {section.schoolYearLabel}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <GradingPeriodSelector
        sectionId={sectionId}
        selectedPeriod={selectedPeriod}
        systemType={gradingSystemType}
        completionStatus={completionStatusObj}
      />

      {/* Content */}
      {students.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No students enrolled
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            There are no enrolled students in this section.
          </p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No subjects configured
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            No subjects are configured for this grade level. Please contact an
            administrator.
          </p>
        </div>
      ) : !canEditSelectedPeriod ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <svg
            className="mx-auto h-12 w-12 text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Period Locked
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Please complete the previous grading period before entering grades for this period.
          </p>
        </div>
      ) : (
        <AdviserGradeEntryGrid
          sectionId={sectionId}
          schoolYearId={section.schoolYearId}
          gradingPeriod={selectedPeriod}
          students={students}
          subjects={subjects}
          initialGradeSheetId={gradeSheetData?.id}
          initialEntries={gradeSheetData?.entries}
          gradeSheetStatus={gradeSheetData?.status}
        />
      )}
    </div>
  );
}
