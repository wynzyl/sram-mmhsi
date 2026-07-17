/**
 * Guard logic for curriculum archival.
 * Checks if a curriculum can be safely archived without breaking active adoptions.
 *
 * @module features/academics/curriculums/archive-guard
 */

export type AdoptionInfo = {
  schoolYearId: string;
  schoolYearLabel: string;
  gradeLevelId: string;
  gradeLevelName: string;
  isActive: boolean; // Is this the active school year?
  /** Is this adoption for a future (upcoming) school year? Future adoptions block archival. */
  isFuture?: boolean;
};

export type ArchiveGuardResult = {
  canArchive: boolean;
  blockers: string[];
  warnings: string[];
  activeAdoptions: AdoptionInfo[];
  inactiveAdoptions: AdoptionInfo[];
};

/**
 * Checks if a curriculum can be archived.
 *
 * A curriculum CANNOT be archived if:
 * - It is adopted for the current active school year
 * - It is adopted for any upcoming (future) school years
 *
 * A curriculum CAN be archived (with warnings) if:
 * - It is adopted only for past school years
 *
 * @param curriculumStatus - Current status of the curriculum
 * @param adoptions - All adoptions for this curriculum
 * @param activeSchoolYearId - ID of the current active school year (if any)
 * @returns Archive guard result with blockers and warnings
 */
export function checkArchiveEligibility(
  curriculumStatus: "draft" | "published" | "archived",
  adoptions: AdoptionInfo[],
  activeSchoolYearId: string | null
): ArchiveGuardResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Only published curriculums can be archived
  if (curriculumStatus !== "published") {
    blockers.push(`Only published curriculums can be archived. Current status: ${curriculumStatus}`);
    return {
      canArchive: false,
      blockers,
      warnings,
      activeAdoptions: [],
      inactiveAdoptions: [],
    };
  }

  // Separate adoptions into active/future (blocking) vs past (informational).
  // A curriculum cannot be archived while it is adopted for the active OR any
  // upcoming school year; only past-only adoptions may be archived (with a warning).
  const activeAdoptions: AdoptionInfo[] = [];
  const futureAdoptions: AdoptionInfo[] = [];
  const inactiveAdoptions: AdoptionInfo[] = [];

  for (const adoption of adoptions) {
    if (adoption.isActive || adoption.schoolYearId === activeSchoolYearId) {
      activeAdoptions.push(adoption);
    } else if (adoption.isFuture) {
      futureAdoptions.push(adoption);
    } else {
      // Non-active, non-future adoptions are treated as historical/past.
      inactiveAdoptions.push(adoption);
    }
  }

  // Block archival if there are active adoptions
  if (activeAdoptions.length > 0) {
    const gradeNames = [...new Set(activeAdoptions.map((a) => a.gradeLevelName))];
    blockers.push(
      `Cannot archive: curriculum is adopted for the active school year in ${gradeNames.join(", ")}. ` +
      `Assign a different curriculum to these grade levels first.`
    );
  }

  // Block archival if there are future adoptions
  if (futureAdoptions.length > 0) {
    const yearLabels = [...new Set(futureAdoptions.map((a) => a.schoolYearLabel))];
    blockers.push(
      `Cannot archive: curriculum is adopted for upcoming school year(s): ${yearLabels.join(", ")}. ` +
      `Assign a different curriculum to those years first.`
    );
  }

  // Warn about historical adoptions (they'll become orphaned but that's expected)
  if (
    inactiveAdoptions.length > 0 &&
    activeAdoptions.length === 0 &&
    futureAdoptions.length === 0
  ) {
    const yearLabels = [...new Set(inactiveAdoptions.map((a) => a.schoolYearLabel))];
    warnings.push(
      `This curriculum has historical adoptions from: ${yearLabels.join(", ")}. ` +
      `These records will be preserved for grade history.`
    );
  }

  return {
    canArchive: blockers.length === 0,
    blockers,
    warnings,
    activeAdoptions,
    inactiveAdoptions,
  };
}

/**
 * Checks if a curriculum is in use (has any adoptions).
 *
 * @param adoptionCount - Number of adoptions for this curriculum
 * @returns True if curriculum is in use
 */
export function isCurriculumInUse(adoptionCount: number): boolean {
  return adoptionCount > 0;
}

/**
 * Checks if an adoption can be changed (curriculum reassignment).
 * Adoptions for school years with existing grades cannot be changed.
 *
 * @param hasGradeRecords - Whether any grade records exist for this adoption
 * @returns Error message if cannot change, null if can change
 */
export function checkAdoptionChangeEligibility(
  hasGradeRecords: boolean
): string | null {
  if (hasGradeRecords) {
    return "Cannot change curriculum adoption: grade records exist for this school year. " +
      "To use a different curriculum, create a new version and adopt it.";
  }
  return null;
}
