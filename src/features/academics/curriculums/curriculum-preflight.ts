/**
 * Preflight validation for curriculum publishing.
 * Checks that a draft curriculum meets all requirements before it can be published.
 *
 * @module features/academics/curriculums/curriculum-preflight
 */

export type PreflightSubjectSummary = {
  gradeLevelId: string;
  gradeLevelName: string;
  subjectCount: number;
};

export type PreflightResult = {
  canPublish: boolean;
  errors: string[];
  warnings: string[];
  subjectsByGrade: PreflightSubjectSummary[];
};

/**
 * Validates that a curriculum is ready for publishing.
 *
 * Requirements:
 * 1. Curriculum must be in 'draft' status
 * 2. Must have at least one subject for each grade level that will be adopted
 * 3. All subjects must have valid codes (no duplicates within grade)
 *
 * @param curriculumStatus - Current status of the curriculum
 * @param subjects - Subjects in the curriculum (active only)
 * @param targetGradeLevelIds - Grade levels where this curriculum will be adopted (optional)
 * @returns Preflight result with canPublish flag and any errors/warnings
 */
export function validatePublishPreflight(
  curriculumStatus: "draft" | "published" | "archived",
  subjects: Array<{
    id: string;
    code: string;
    gradeLevelId: string | null;
    gradeLevelName: string;
  }>,
  targetGradeLevelIds?: string[]
): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check status
  if (curriculumStatus !== "draft") {
    errors.push(`Curriculum must be in 'draft' status to publish. Current status: ${curriculumStatus}`);
  }

  // Group subjects by grade level
  const subjectsByGrade = new Map<string, { gradeLevelName: string; subjects: typeof subjects }>();

  for (const subject of subjects) {
    if (!subject.gradeLevelId) {
      warnings.push(`Subject "${subject.code}" has no grade level assigned.`);
      continue;
    }

    const existing = subjectsByGrade.get(subject.gradeLevelId);
    if (existing) {
      existing.subjects.push(subject);
    } else {
      subjectsByGrade.set(subject.gradeLevelId, {
        gradeLevelName: subject.gradeLevelName,
        subjects: [subject],
      });
    }
  }

  // Check for duplicate codes within each grade
  for (const [, { gradeLevelName, subjects: gradeSubjects }] of subjectsByGrade) {
    const codes = new Set<string>();
    for (const subject of gradeSubjects) {
      if (codes.has(subject.code.toLowerCase())) {
        errors.push(`Duplicate subject code "${subject.code}" in ${gradeLevelName}.`);
      }
      codes.add(subject.code.toLowerCase());
    }
  }

  // If target grade levels are specified, check coverage
  if (targetGradeLevelIds && targetGradeLevelIds.length > 0) {
    for (const gradeLevelId of targetGradeLevelIds) {
      const gradeData = subjectsByGrade.get(gradeLevelId);
      if (!gradeData || gradeData.subjects.length === 0) {
        // Get the grade name from any subject or mark as unknown
        const anySubject = subjects.find(s => s.gradeLevelId === gradeLevelId);
        const gradeName = anySubject?.gradeLevelName || `Grade (${gradeLevelId.slice(0, 8)}...)`;
        errors.push(`No subjects defined for ${gradeName}. Add at least one subject before publishing.`);
      }
    }
  } else if (subjectsByGrade.size === 0) {
    errors.push("Curriculum has no subjects. Add at least one subject before publishing.");
  }

  // Build summary
  const subjectSummary: PreflightSubjectSummary[] = Array.from(subjectsByGrade.entries()).map(
    ([gradeLevelId, { gradeLevelName, subjects: gradeSubjects }]) => ({
      gradeLevelId,
      gradeLevelName,
      subjectCount: gradeSubjects.length,
    })
  );

  return {
    canPublish: errors.length === 0,
    errors,
    warnings,
    subjectsByGrade: subjectSummary,
  };
}

/**
 * Checks if a curriculum name is valid for publishing.
 * Names must be unique among published curriculums.
 *
 * @param name - Curriculum name to check
 * @param existingPublishedNames - Names of currently published curriculums
 * @returns Error message if invalid, null if valid
 */
export function validateCurriculumName(
  name: string,
  existingPublishedNames: string[]
): string | null {
  const trimmedName = name.trim();

  if (trimmedName.length < 3) {
    return "Curriculum name must be at least 3 characters.";
  }

  if (trimmedName.length > 100) {
    return "Curriculum name must be 100 characters or less.";
  }

  const lowerName = trimmedName.toLowerCase();
  const isDuplicate = existingPublishedNames.some(
    (existing) => existing.toLowerCase() === lowerName
  );

  if (isDuplicate) {
    return "A published curriculum with this name already exists.";
  }

  return null;
}
