"use client";

import type { TeacherAssignmentCard } from "../grades.queries";

interface TeacherSubjectCardsProps {
  assignments: TeacherAssignmentCard[];
}

export function TeacherSubjectCards({ assignments }: TeacherSubjectCardsProps) {
  if (assignments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">My Subject Classes</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Subjects assigned to you for teaching (view only)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignments.map((assignment) => (
          <div
            key={assignment.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-lg">
                {assignment.subject?.code?.substring(0, 2) || "S"}
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {assignment.section?.name}
              </span>
            </div>

            <h3 className="text-lg font-bold text-gray-900">
              {assignment.subject?.name}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {assignment.subject?.code}
            </p>

            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center text-sm text-gray-500">
              <svg
                className="mr-1.5 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Grade entry by section adviser
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
