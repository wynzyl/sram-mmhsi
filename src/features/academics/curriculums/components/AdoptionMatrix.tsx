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
    <section
      className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
      aria-labelledby="adoption-heading"
    >
      {/* Card Header with gradient effect */}
      <div className="bg-muted flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Title + Stats Badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2
            id="adoption-heading"
            className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary"
          >
            Adoption Matrix
          </h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
            {matrixCells.length} Grade Level{matrixCells.length !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
            {adoptedCount} Adopted
          </span>
          {lockedCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning/10 text-warning border border-warning/30">
              {lockedCount} Locked
            </span>
          )}
        </div>

        {/* Right: School Year Selector (single row, no wrapping) */}
        <div className="filter-controls-inline">
          <AdoptionSchoolYearSelector
            schoolYears={schoolYears}
            selectedYearId={selectedSchoolYear.id}
          />
        </div>
      </div>

      {/* Adoption Matrix Table */}
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
                key={`${cell.gradeLevelId}-${cell.curriculumId ?? "none"}`}
                cell={cell}
                schoolYearId={selectedSchoolYear.id}
                curriculumOptions={curriculumOptions}
                isLocked={lockedGradeLevels.has(cell.gradeLevelId)}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
