"use client";

import Link from "next/link";
import type { AdviserSectionCard } from "../grades.queries";

interface AdviserSectionCardsProps {
  sections: AdviserSectionCard[];
}

export function AdviserSectionCards({ sections }: AdviserSectionCardsProps) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">My Advisory Sections</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Enter grades for students in your advisory section
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={`/staff/grades/sections/${section.sectionId}`}
            className="block group"
          >
            <div className="bg-card rounded-xl border border-border shadow-sm p-6 hover:shadow-md hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {section.gradeLevelName.charAt(0).toUpperCase()}
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  Section {section.sectionName}
                </span>
              </div>

              <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                {section.gradeLevelName}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Section {section.sectionName}
              </p>

              <div className="mt-4 pt-4 border-t border-border flex items-center text-sm text-primary font-medium">
                Enter Grades
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
