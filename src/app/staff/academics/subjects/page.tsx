import { db } from "@/lib/db";
import { eq, isNull } from "drizzle-orm";
import { subjects, gradeLevels } from "@/lib/db/schema";
import { CreateSubjectForm } from "@/features/academics";
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import { deleteSubjectAction } from "@/features/academics";

export default async function StaffSubjectManagementPage() {
  const gradeLevelsList = await db.query.gradeLevels.findMany({
    columns: { id: true, name: true },
    orderBy: (gl, { asc }) => [asc(gl.order)],
  });

  const subjectsList = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
      gradeLevel: {
        name: gradeLevels.name,
      },
      createdAt: subjects.createdAt,
    })
    .from(subjects)
    .leftJoin(gradeLevels, eq(subjects.gradeLevelId, gradeLevels.id))
    .where(isNull(subjects.deletedAt))
    .orderBy(subjects.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Subject Management</h1>
      </div>

      <CreateSubjectForm gradeLevels={gradeLevelsList} />

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Subject Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Subject Code</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Grade Level</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {subjectsList.length === 0 ? (
              <tr>
                <td colSpan={4} className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500">
                  No subjects found.
                </td>
              </tr>
            ) : (
              subjectsList.map((subject) => (
                <tr key={subject.id}>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{subject.name}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm text-gray-500">{subject.code}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                      {subject.gradeLevel?.name || "Unassigned"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <InlineConfirmButton
                      action={deleteSubjectAction}
                      confirmMessage="Are you sure you want to delete this subject?"
                      hiddenFields={{ subjectId: subject.id }}
                      label="Delete"
                      loadingLabel="Deleting..."
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
