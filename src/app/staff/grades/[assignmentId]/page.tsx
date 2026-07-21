import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import {
  teacherAssignments,
  subjects,
  sections,
  schoolYears,
  gradeLevels,
  enrollments,
  students,
} from "@/lib/db/schema";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export default async function GradeEncodingPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const session = await requireSession();
  const { assignmentId } = await params;

  // Verify assignment exists and belongs to the teacher
  const [assignment] = await db.select({
    id: teacherAssignments.id,
    teacherId: teacherAssignments.teacherId,
    schoolYearId: teacherAssignments.schoolYearId,
    sectionId: teacherAssignments.sectionId,
    subject: {
      name: subjects.name,
      code: subjects.code,
    },
    section: {
      name: sections.name,
    },
    gradeLevel: {
      name: gradeLevels.name,
    },
    schoolYear: {
      label: schoolYears.label,
    }
  }).from(teacherAssignments)
    .leftJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .leftJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .leftJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .leftJoin(schoolYears, eq(teacherAssignments.schoolYearId, schoolYears.id))
    .where(
      and(
        eq(teacherAssignments.id, assignmentId),
        isNull(teacherAssignments.deletedAt),
        isNull(subjects.deletedAt)
      )
    );

  if (!assignment) notFound();
  
  // Teachers can only view their own assignments, but admins could view any
  if (session.role === "teacher" && assignment.teacherId !== session.userId) {
    redirect("/staff/grades");
  }

  // Fetch enrolled students for this section & school year
  const sectionEnrollments = await db.select({
    studentId: students.id,
    lastName: students.lastName,
    firstName: students.firstName,
  }).from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(
      and(
        eq(enrollments.sectionId, assignment.sectionId),
        eq(enrollments.schoolYearId, assignment.schoolYearId),
        eq(enrollments.status, "enrolled")
      )
    )
    .orderBy(students.lastName, students.firstName);

  // This view is read-only (grade entry is handled by the section adviser), so we
  // only need the student roster — id + display name.
  const studentsData = sectionEnrollments.map((enr) => ({
    id: enr.studentId,
    name: `${enr.lastName}, ${enr.firstName}`,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link
            href="/staff/grades"
            className="hover:text-primary transition-colors"
          >
            Grades
          </Link>
          <span>/</span>
          <span className="text-foreground">{assignment.subject?.name}</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">{assignment.subject?.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {assignment.subject?.code}
        </p>

        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Grade Level:</span>
            <p className="font-medium text-foreground">{assignment.gradeLevel?.name || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Section:</span>
            <p className="font-medium text-foreground">{assignment.section?.name || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">School Year:</span>
            <p className="font-medium text-foreground">{assignment.schoolYear?.label || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Students:</span>
            <p className="font-medium text-foreground">{studentsData.length}</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Grade entry is managed by the section adviser. This view is for reference only.
          </p>
        </div>
      </div>

      {/* Students List */}
      {studentsData.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-xl border border-border shadow-sm">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
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
          <h3 className="mt-2 text-sm font-medium text-foreground">No students enrolled</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            No students are currently enrolled in this section.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Enrolled Students</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Student Name
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {studentsData.map((student, index) => (
                  <tr key={student.id} className={index % 2 === 0 ? "bg-card" : "bg-muted/50"}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {student.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
