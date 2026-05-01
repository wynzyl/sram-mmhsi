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
  gradeRecords
} from "@/lib/db/schema";
import { notFound, redirect } from "next/navigation";
import { GradeEncodingTable } from "@/components/academics/GradeEncodingTable";

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
    schoolYear: {
      label: schoolYears.label,
    }
  }).from(teacherAssignments)
    .leftJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .leftJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .leftJoin(schoolYears, eq(teacherAssignments.schoolYearId, schoolYears.id))
    .where(eq(teacherAssignments.id, assignmentId));

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

  // Fetch existing grades for this assignment
  const existingGrades = await db.query.gradeRecords.findMany({
    where: eq(gradeRecords.teacherAssignmentId, assignmentId),
  });

  // Transform data for the table
  const studentsData = sectionEnrollments.map(enr => {
    const sGrades = existingGrades.filter(g => g.studentId === enr.studentId);
    return {
      id: enr.studentId,
      name: `${enr.lastName}, ${enr.firstName}`,
      grades: {
        Q1: sGrades.find(g => g.gradingPeriod === "Q1") ? { 
          grade: sGrades.find(g => g.gradingPeriod === "Q1")!.grade!, 
          status: sGrades.find(g => g.gradingPeriod === "Q1")!.status 
        } : undefined,
        Q2: sGrades.find(g => g.gradingPeriod === "Q2") ? { 
          grade: sGrades.find(g => g.gradingPeriod === "Q2")!.grade!, 
          status: sGrades.find(g => g.gradingPeriod === "Q2")!.status 
        } : undefined,
        Q3: sGrades.find(g => g.gradingPeriod === "Q3") ? { 
          grade: sGrades.find(g => g.gradingPeriod === "Q3")!.grade!, 
          status: sGrades.find(g => g.gradingPeriod === "Q3")!.status 
        } : undefined,
        Q4: sGrades.find(g => g.gradingPeriod === "Q4") ? { 
          grade: sGrades.find(g => g.gradingPeriod === "Q4")!.grade!, 
          status: sGrades.find(g => g.gradingPeriod === "Q4")!.status 
        } : undefined,
      }
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{assignment.subject?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Section: <span className="font-medium text-gray-900">{assignment.section?.name}</span> | 
            Subject Code: <span className="font-medium text-gray-900">{assignment.subject?.code}</span> | 
            School Year: <span className="font-medium text-gray-900">{assignment.schoolYear?.label}</span>
          </p>
        </div>
      </div>

      {studentsData.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-gray-500">No students are currently enrolled in this section.</p>
        </div>
      ) : (
        <GradeEncodingTable 
          assignmentId={assignmentId}
          schoolYearId={assignment.schoolYearId}
          students={studentsData}
        />
      )}
    </div>
  );
}
