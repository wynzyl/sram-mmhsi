import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { 
  teacherAssignments, 
  subjects, 
  sections, 
  schoolYears,
  enrollments,
  students,
  gradeRecords,
  users
} from "@/lib/db/schema";
import { notFound } from "next/navigation";
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import { lockGradesAction } from "@/actions/academics";

export default async function AdminGradeViewPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  await requireSession(); // Assume layout checks admin role
  const { assignmentId } = await params;

  const [assignment] = await db.select({
    id: teacherAssignments.id,
    teacher: {
      username: users.username,
    },
    subject: {
      name: subjects.name,
      code: subjects.code,
    },
    section: {
      name: sections.name,
    },
    schoolYear: {
      label: schoolYears.label,
    }
  }).from(teacherAssignments)
    .leftJoin(users, eq(teacherAssignments.teacherId, users.id))
    .leftJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .leftJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .leftJoin(schoolYears, eq(teacherAssignments.schoolYearId, schoolYears.id))
    .where(eq(teacherAssignments.id, assignmentId));

  if (!assignment) notFound();

  // Fetch existing grades
  const existingGrades = await db.query.gradeRecords.findMany({
    where: eq(gradeRecords.teacherAssignmentId, assignmentId),
  });

  // Check locking status for each quarter
  const getQuarterStatus = (period: string) => {
    const gradesForPeriod = existingGrades.filter(g => g.gradingPeriod === period);
    if (gradesForPeriod.length === 0) return "none";
    if (gradesForPeriod.every(g => g.status === "locked")) return "locked";
    if (gradesForPeriod.some(g => g.status === "submitted")) return "submitted";
    return "draft";
  };

  const statuses = {
    Q1: getQuarterStatus("Q1"),
    Q2: getQuarterStatus("Q2"),
    Q3: getQuarterStatus("Q3"),
    Q4: getQuarterStatus("Q4"),
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{assignment.subject?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Teacher: <span className="font-medium text-gray-900">{assignment.teacher?.username}</span> | 
            Section: <span className="font-medium text-gray-900">{assignment.section?.name}</span> | 
            Subject Code: <span className="font-medium text-gray-900">{assignment.subject?.code}</span> | 
            School Year: <span className="font-medium text-gray-900">{assignment.schoolYear?.label}</span>
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Grading Periods</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
            <div key={q} className="border border-gray-200 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-gray-900">{q} Grades</h4>
                <p className="text-sm text-gray-500 mt-1">Status: {statuses[q].toUpperCase()}</p>
              </div>
              <div className="mt-4">
                {statuses[q] === "submitted" ? (
                  <InlineConfirmButton
                    action={lockGradesAction}
                    confirmMessage={`Are you sure you want to lock grades for ${q}? This cannot be undone.`}
                    hiddenFields={{ assignmentId, gradingPeriod: q }}
                    label="Lock"
                    loadingLabel="Locking..."
                    variant="primary"
                  />
                ) : statuses[q] === "locked" ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    LOCKED
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Cannot lock yet</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
