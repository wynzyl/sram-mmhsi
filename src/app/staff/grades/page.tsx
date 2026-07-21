import { requireSession } from "@/lib/auth/session";
import {
  getActiveSchoolYear,
  getTeacherAssignments,
  getAdviserSections,
} from "@/features/academics/grades/grades.queries";
import { AdviserSectionCards } from "@/features/academics/grades/components/AdviserSectionCards";
import { TeacherSubjectCards } from "@/features/academics/grades/components/TeacherSubjectCards";

export default async function GradesDashboardPage() {
  const session = await requireSession();

  // Find active school year
  const activeSY = await getActiveSchoolYear();

  if (!activeSY) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg text-yellow-800">
        No active school year found. Please contact the administrator.
      </div>
    );
  }

  // Fetch both adviser sections and teacher assignments in parallel
  const [adviserSections, teacherAssignments] = await Promise.all([
    getAdviserSections(session.userId, activeSY.id),
    getTeacherAssignments(session.userId, activeSY.id),
  ]);

  const hasAdviserSections = adviserSections.length > 0;
  const hasTeacherAssignments = teacherAssignments.length > 0;
  const hasNoAssignments = !hasAdviserSections && !hasTeacherAssignments;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Grades</h1>
        <p className="text-sm text-gray-500 mt-1">
          School Year: {activeSY.label}
        </p>
      </div>

      {hasNoAssignments ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No assignments found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            You have no section adviser or subject assignments for the current
            school year.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Advisory Sections - Primary action area for grade entry */}
          {hasAdviserSections && (
            <AdviserSectionCards sections={adviserSections} />
          )}

          {/* Teacher Subject Assignments - View only */}
          {hasTeacherAssignments && (
            <TeacherSubjectCards assignments={teacherAssignments} />
          )}
        </div>
      )}
    </div>
  );
}
