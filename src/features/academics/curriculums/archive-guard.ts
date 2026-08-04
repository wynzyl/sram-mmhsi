/**
 * Guard logic for curriculum archival.
 * Checks if a curriculum can be safely archived without breaking active adoptions.
 *
 * @module features/academics/curriculums/archive-guard
 */

/**
 * Explicit timing classification for an adoption relative to the active school year.
 * - `active`     — adoption for the current active school year (blocks archival)
 * - `future`     — adoption for an upcoming school year (blocks archival)
 * - `historical` — adoption for a past school year (archivable, with a warning)
 * - `unknown`    — timing could not be determined (e.g. no active-year reference
 *                  point); treated conservatively as blocking, never as historical.
 */
export type AdoptionTiming = "active" | "future" | "historical" | "unknown";

export type AdoptionInfo = {
  schoolYearId: string;
  schoolYearLabel: string;
  gradeLevelId: string;
  gradeLevelName: string;
  /**
   * Explicit active/future/historical classification. The caller must classify
   * every adoption; unknown/undetermined timing (`"unknown"`) conservatively
   * blocks archival rather than being silently treated as historical.
   */
  timing: AdoptionTiming;
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

  // Separate adoptions into active/future/unknown (blocking) vs past (informational).
  // A curriculum cannot be archived while it is adopted for the active OR any
  // upcoming school year; only past-only adoptions may be archived (with a warning).
  // Timing must be classified explicitly by the caller — an adoption whose timing
  // is `"unknown"` is treated conservatively as blocking, never as historical.
  const activeAdoptions: AdoptionInfo[] = [];
  const futureAdoptions: AdoptionInfo[] = [];
  const unknownAdoptions: AdoptionInfo[] = [];
  const inactiveAdoptions: AdoptionInfo[] = [];

  for (const adoption of adoptions) {
    if (adoption.timing === "active" || adoption.schoolYearId === activeSchoolYearId) {
      activeAdoptions.push(adoption);
    } else if (adoption.timing === "future") {
      futureAdoptions.push(adoption);
    } else if (adoption.timing === "historical") {
      inactiveAdoptions.push(adoption);
    } else {
      // Unknown / undetermined timing — cannot be proven historical, so block.
      unknownAdoptions.push(adoption);
    }
  }

  // Block archival if there are active adoptions
  if (activeAdoptions.length > 0) {
    // Callers may omit gradeLevelName (some pass "" when it's not otherwise
    // needed). Fall back to a non-empty identifier derived from gradeLevelId so
    // the blocker never renders a blank/dangling grade list.
    const gradeNames = [
      ...new Set(
        activeAdoptions.map(
          (a) => a.gradeLevelName?.trim() || `Grade (${a.gradeLevelId.slice(0, 8)}…)`
        )
      ),
    ];
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

  // Block archival if any adoption's timing could not be determined. We cannot
  // prove these are historical, so we refuse rather than risk orphaning an
  // active or upcoming adoption.
  if (unknownAdoptions.length > 0) {
    const yearLabels = [...new Set(unknownAdoptions.map((a) => a.schoolYearLabel))];
    blockers.push(
      `Cannot archive: the timing of adoption(s) for ${yearLabels.join(", ")} could not be ` +
      `determined (no active school year to compare against). Set an active school year first.`
    );
  }

  // Warn about historical adoptions (they'll become orphaned but that's expected)
  if (
    inactiveAdoptions.length > 0 &&
    activeAdoptions.length === 0 &&
    futureAdoptions.length === 0 &&
    unknownAdoptions.length === 0
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
