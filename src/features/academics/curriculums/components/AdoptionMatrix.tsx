"use client";

import { AdoptionSchoolYearSelector } from "./AdoptionSchoolYearSelector";
import { AdoptionMatrixRow } from "./AdoptionMatrixRow";
import type { AdoptionMatrixCell, CurriculumDropdownOption } from "../curriculums.types";

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface AdoptionMatrixProps {
  matrixCells: AdoptionMatrixCell[];
  curriculumOptions: CurriculumDropdownOption[];
  schoolYears: SchoolYearOption[];
  selectedSchoolYear: SchoolYearOption;
  lockedGradeLevels: Set<string>;
}

export function AdoptionMatrix({
  matrixCells,
  curriculumOptions,
  schoolYears,
  selectedSchoolYear,
  lockedGradeLevels,
}: AdoptionMatrixProps) {
  const adoptedCount = matrixCells.filter((c) => c.curriculumId !== null).length;
  const lockedCount = lockedGradeLevels.size;

  return (
    <div className="space-y-6">
      {/* School Year Selector */}
      <AdoptionSchoolYearSelector
        schoolYears={schoolYears}
        selectedYearId={selectedSchoolYear.id}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Grade Levels"
          value={matrixCells.length}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <StatCard
          label="Adopted"
          value={adoptedCount}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Locked (Grades Exist)"
          value={lockedCount}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
        />
      </div>

      {/* Adoption Matrix Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {curriculumOptions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">
              No published curriculums available. Publish a curriculum first to enable adoptions.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                  Grade Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                  Adopted Curriculum
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {matrixCells.map((cell) => (
                <AdoptionMatrixRow
                  key={cell.gradeLevelId}
                  cell={cell}
                  schoolYearId={selectedSchoolYear.id}
                  curriculumOptions={curriculumOptions}
                  isLocked={lockedGradeLevels.has(cell.gradeLevelId)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
      <div className="p-2 bg-primary/10 text-primary rounded-lg">{icon}</div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
