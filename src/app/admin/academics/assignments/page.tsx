import { db } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { users, subjects, sections, schoolYears, teacherAssignments } from "@/lib/db/schema";
import { AssignTeacherForm } from "@/components/academics/AssignTeacherForm";
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import { removeAssignmentAction } from "@/actions/academics";

export default async function TeacherAssignmentsPage() {
  // Fetch required data for the form
  const teachersList = await db.query.users.findMany({
    where: eq(users.role, "teacher"),
    columns: { id: true, username: true, email: true },
  });

  const subjectsList = await db.query.subjects.findMany({
    where: isNull(subjects.deletedAt),
    columns: { id: true, name: true, code: true },
  });

  const sectionsList = await db.query.sections.findMany({
    columns: { id: true, name: true },
  });

  const schoolYearsList = await db.query.schoolYears.findMany({
    columns: { id: true, label: true, isActive: true },
  });

  // Fetch current assignments
  const assignments = await db.select({
    id: teacherAssignments.id,
    teacher: {
      username: users.username,
      email: users.email,
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
    },
    createdAt: teacherAssignments.createdAt,
  }).from(teacherAssignments)
    .leftJoin(users, eq(teacherAssignments.teacherId, users.id))
    .leftJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .leftJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .leftJoin(schoolYears, eq(teacherAssignments.schoolYearId, schoolYears.id))
    .where(
      and(
        isNull(teacherAssignments.deletedAt),
        isNull(subjects.deletedAt)
      )
    )
    .orderBy(teacherAssignments.createdAt);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Teacher Assignments</h1>
      </div>

      <AssignTeacherForm 
        teachers={teachersList} 
        subjects={subjectsList} 
        sections={sectionsList} 
        schoolYears={schoolYearsList} 
      />

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">School Year</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  No assignments found.
                </td>
              </tr>
            ) : (
              assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{assignment.teacher?.username}</div>
                    <div className="text-sm text-gray-500">{assignment.teacher?.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{assignment.subject?.name}</div>
                    <div className="text-sm text-gray-500">{assignment.subject?.code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {assignment.section?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {assignment.schoolYear?.label}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a href={`/admin/academics/assignments/${assignment.id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">View Grades</a>
                    <InlineConfirmButton
                      action={removeAssignmentAction}
                      confirmMessage="Are you sure you want to remove this assignment?"
                      hiddenFields={{ assignmentId: assignment.id }}
                      label="Remove"
                      loadingLabel="Removing..."
                      variant="danger"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
