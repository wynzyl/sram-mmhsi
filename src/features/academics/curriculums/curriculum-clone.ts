/**
 * Pure function to clone a curriculum's subjects.
 * Creates subject records for a new draft curriculum from a published/archived source.
 *
 * @module features/academics/curriculums/curriculum-clone
 */

import type { InferSelectModel } from "drizzle-orm";
import type { subjects } from "@/lib/db/schema";

type Subject = InferSelectModel<typeof subjects>;

export type SubjectCloneInput = Pick<
  Subject,
  | "name"
  | "code"
  | "description"
  | "gradeLevelId"
  | "units"
  | "sequenceOrder"
  | "isCore"
  | "gradingWeight"
>;

/**
 * Prepares subject data for cloning to a new curriculum.
 * Strips audit fields and IDs, preserving only the educational content.
 *
 * @param sourceSubjects - Subjects from the source curriculum
 * @returns Array of subject data ready for insertion
 */
export function prepareSubjectsForClone(
  sourceSubjects: Subject[]
): SubjectCloneInput[] {
  return sourceSubjects
    .filter((s) => s.deletedAt === null) // Only clone active subjects
    .map((s) => ({
      name: s.name,
      code: s.code,
      description: s.description,
      gradeLevelId: s.gradeLevelId,
      units: s.units,
      sequenceOrder: s.sequenceOrder,
      isCore: s.isCore,
      gradingWeight: s.gradingWeight,
    }));
}

/**
 * Generates the next version number for a curriculum in a version chain.
 *
 * @param existingVersions - Array of version numbers in the chain
 * @returns Next version number
 */
export function getNextVersion(existingVersions: number[]): number {
  if (existingVersions.length === 0) {
    return 1;
  }
  return Math.max(...existingVersions) + 1;
}

/**
 * Generates a default name for a new draft curriculum.
 *
 * @param sourceName - Name of the source curriculum
 * @param version - Version number for the new draft
 * @returns Generated name
 */
export function generateDraftName(sourceName: string, version: number): string {
  // Remove any existing version suffix like " (v2)" or " v3"
  const baseName = sourceName.replace(/\s*\(?v\d+\)?$/i, "").trim();
  return `${baseName} (v${version})`;
}
