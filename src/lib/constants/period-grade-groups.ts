/**
 * Grade level groups for period assignment.
 * Simplified groups for class schedules (different from coordinator grade groups).
 */
export const PERIOD_GRADE_GROUPS = [
  "casa",
  "elementary",
  "jhs",
  "shs",
] as const;

export type PeriodGradeGroup = (typeof PERIOD_GRADE_GROUPS)[number];

export const PERIOD_GRADE_GROUP_LABELS: Record<PeriodGradeGroup, string> = {
  casa: "Casa (Junior, Senior, Advance)",
  elementary: "Elementary (Grade 1-6)",
  jhs: "JHS (Grade 7-10)",
  shs: "SHS (Grade 11-12)",
};

/**
 * Map grade level names to their period group.
 * Keys match the gradeLevels.name column values.
 */
export const GRADE_LEVEL_TO_PERIOD_GROUP: Record<string, PeriodGradeGroup> = {
  // Casa / Kinder levels
  "Kinder - Junior": "casa",
  "Kinder - Senior": "casa",
  "Kinder - Advance": "casa",
  "Junior Casa": "casa",
  "Senior Casa": "casa",
  "Advance Casa": "casa",
  Kindergarten: "casa",
  Kinder: "casa",

  // Elementary (Grades 1-6)
  "Grade 1": "elementary",
  "Grade 2": "elementary",
  "Grade 3": "elementary",
  "Grade 4": "elementary",
  "Grade 5": "elementary",
  "Grade 6": "elementary",

  // Junior High School (Grades 7-10)
  "Grade 7": "jhs",
  "Grade 8": "jhs",
  "Grade 9": "jhs",
  "Grade 10": "jhs",

  // Senior High School (Grades 11-12)
  "Grade 11": "shs",
  "Grade 12": "shs",
};

/**
 * Get the period group for a grade level name.
 * Returns undefined if the grade level is not mapped.
 */
export function getPeriodGradeGroup(gradeLevelName: string): PeriodGradeGroup | undefined {
  return GRADE_LEVEL_TO_PERIOD_GROUP[gradeLevelName];
}

/**
 * Get all grade level names for a period group.
 */
export function getGradeLevelsForPeriodGroup(group: PeriodGradeGroup): string[] {
  return Object.entries(GRADE_LEVEL_TO_PERIOD_GROUP)
    .filter(([, g]) => g === group)
    .map(([name]) => name);
}

/**
 * Check if a grade level name belongs to a specific period group.
 */
export function isGradeInPeriodGroup(gradeLevelName: string, group: PeriodGradeGroup): boolean {
  return GRADE_LEVEL_TO_PERIOD_GROUP[gradeLevelName] === group;
}
