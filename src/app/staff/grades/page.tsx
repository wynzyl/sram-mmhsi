import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { teacherAssignments, schoolYears, subjects, sections } from "@/lib/db/schema";
import Link from "next/link";

export default async function TeacherDashboardPage() {
  const session = await requireSession();

  // Find active school year
  const activeSY = await db.query.schoolYears.findFirst({
    where: eq(schoolYears.isActive, true),
  });

  if (!activeSY) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg text-yellow-800">
        No active school year found. Please contact the administrator.
      </div>
    );
  }

  // Fetch teacher's assignments for the active school year
  const assignments = await db.select({
    id: teacherAssignments.id,
    subject: {
      name: subjects.name,
      code: subjects.code,
    },
    section: {
      name: sections.name,
    },
  }).from(teacherAssignments)
    .leftJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .leftJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .where(
      and(
        eq(teacherAssignments.teacherId, session.userId),
        eq(teacherAssignments.schoolYearId, activeSY.id)
      )
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
        <p className="text-sm text-gray-500 mt-1">School Year: {activeSY.label}</p>
      </div>

      {assignments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No classes assigned</h3>
          <p className="mt-1 text-sm text-gray-500">You have no class assignments for the current school year.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.map((assignment) => (
            <Link 
              key={assignment.id} 
              href={`/staff/grades/${assignment.id}`}
              className="block group"
            >
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md hover:border-indigo-100 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                    {assignment.subject?.code?.substring(0, 2) || "S"}
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {assignment.section?.name}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {assignment.subject?.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {assignment.subject?.code}
                </p>
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center text-sm text-indigo-600 font-medium">
                  Encode Grades
                  <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
