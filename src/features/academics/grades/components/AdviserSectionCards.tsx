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
        <h2 className="text-lg font-semibold text-gray-900">My Advisory Sections</h2>
        <p className="text-sm text-gray-500 mt-0.5">
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
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md hover:border-primary-100 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-lg">
                  {section.sectionName.charAt(0).toUpperCase()}
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  {section.gradeLevelName}
                </span>
              </div>

              <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                Section {section.sectionName}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {section.gradeLevelName}
              </p>

              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center text-sm text-primary-600 font-medium">
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
