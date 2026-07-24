"use client";

import Link from "next/link";
import type { TeacherClassCard } from "../subject-offerings.queries";

interface TeacherClassesCardsProps {
  classes: TeacherClassCard[];
}

/**
 * Displays cards for a teacher's assigned subject offerings.
 * Links to section detail page (read-only view) - teachers don't encode grades directly.
 * Grade encoding is handled by section advisers via the adviser workflow.
 */
export function TeacherClassesCards({ classes }: TeacherClassesCardsProps) {
  if (classes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">My Assigned Subjects</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Subjects assigned to you for the current school year
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((classItem) => (
          <Link
            key={classItem.id}
            href={`/staff/academics/sections/${classItem.sectionId}`}
            className="block group"
          >
            <div className="bg-card rounded-xl border border-border shadow-sm p-6 hover:shadow-md hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold text-lg">
                  {classItem.subjectCode?.substring(0, 2) || "S"}
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  {classItem.sectionName}
                </span>
              </div>

              <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                {classItem.subjectName}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {classItem.subjectCode}
              </p>

              <div className="mt-4 pt-4 border-t border-border space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Grade Level:</span>
                  <span className="font-medium text-foreground">{classItem.gradeLevelName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Section:</span>
                  <span className="font-medium text-foreground">{classItem.sectionName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Students:</span>
                  <span className="font-medium text-foreground">{classItem.studentCount}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border flex items-center text-sm text-primary font-medium">
                View Section
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
