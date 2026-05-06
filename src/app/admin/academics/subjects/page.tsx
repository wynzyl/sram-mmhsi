import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { subjects, gradeLevels } from "@/lib/db/schema";
import { CreateSubjectForm } from "@/components/academics/CreateSubjectForm";
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import { deleteSubjectAction } from "@/actions/academics";

export default async function SubjectManagementPage() {
  const gradeLevelsList = await db.query.gradeLevels.findMany({
    columns: { id: true, name: true },
    orderBy: (gradeLevels, { asc }) => [asc(gradeLevels.order)],
  });

  const subjectsList = await db.select({
    id: subjects.id,
    name: subjects.name,
    code: subjects.code,
    gradeLevel: {
      name: gradeLevels.name,
    },
    createdAt: subjects.createdAt,
  }).from(subjects)
    .leftJoin(gradeLevels, eq(subjects.gradeLevelId, gradeLevels.id))
    .orderBy(subjects.name);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Subject Management</h1>
      </div>

      <CreateSubjectForm gradeLevels={gradeLevelsList} />

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Code</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade Level</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subjectsList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  No subjects found.
                </td>
              </tr>
            ) : (
              subjectsList.map((subject) => (
                <tr key={subject.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{subject.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{subject.code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {subject.gradeLevel?.name || "Unassigned"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
