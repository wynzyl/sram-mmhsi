"use client";

import Link from "next/link";
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
        <h2 className="text-lg font-semibold text-foreground">My Subject Classes</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Subjects assigned to you for teaching
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignments.map((assignment) => (
          <Link
            key={assignment.id}
            href={`/staff/academics/sections/${assignment.sectionId}`}
            className="block group"
          >
            <div className="bg-card rounded-xl border border-border shadow-sm p-6 hover:shadow-md hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold text-lg">
                {assignment.subject?.code?.substring(0, 2) || "S"}
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                {assignment.section?.name}
              </span>
            </div>

            <h3 className="text-lg font-bold text-foreground">
              {assignment.subject?.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {assignment.subject?.code}
            </p>

            <div className="mt-4 pt-4 border-t border-border space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Grade Level:</span>
                <span className="font-medium text-foreground">{assignment.gradeLevel?.name || "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Section:</span>
                <span className="font-medium text-foreground">{assignment.section?.name || "—"}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border flex items-center text-sm text-primary font-medium">
              View Students
              <svg
                className="ml-1.5 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
