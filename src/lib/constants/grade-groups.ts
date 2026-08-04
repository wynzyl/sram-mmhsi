/**
 * Grade level groups for coordinator assignment.
 * Coordinators are assigned to review grade submissions for their group.
 */
export const GRADE_GROUPS = [
  "casa",
  "lower_elem",
  "higher_elem",
  "jhs",
  "shs",
] as const;

export type GradeGroup = (typeof GRADE_GROUPS)[number];

export const GRADE_GROUP_LABELS: Record<GradeGroup, string> = {
  casa: "Casa (Kinder)",
  lower_elem: "Lower Elementary (Grades 1-3)",
  higher_elem: "Higher Elementary (Grades 4-6)",
  jhs: "Junior High School (Grades 7-10)",
  shs: "Senior High School (Grades 11-12)",
};

/**
 * Map grade level names to their group.
 * Keys match the gradeLevels.name column values.
 */
export const GRADE_LEVEL_TO_GROUP: Record<string, GradeGroup> = {
  // Casa / Kinder levels
  "Kinder - Junior": "casa",
  "Kinder - Senior": "casa",
  "Kinder - Advance": "casa",
  Kindergarten: "casa",
  Kinder: "casa",

  // Lower Elementary
  "Grade 1": "lower_elem",
  "Grade 2": "lower_elem",
  "Grade 3": "lower_elem",

  // Higher Elementary
  "Grade 4": "higher_elem",
  "Grade 5": "higher_elem",
  "Grade 6": "higher_elem",

  // Junior High School
  "Grade 7": "jhs",
  "Grade 8": "jhs",
  "Grade 9": "jhs",
  "Grade 10": "jhs",

  // Senior High School
  "Grade 11": "shs",
  "Grade 12": "shs",
};

/**
 * Get the group for a grade level name.
 * Returns undefined if the grade level is not mapped.
 */
export function getGradeGroup(gradeLevelName: string): GradeGroup | undefined {
  return GRADE_LEVEL_TO_GROUP[gradeLevelName];
}

/**
 * Get all grade level names for a group.
 */
export function getGradeLevelsForGroup(group: GradeGroup): string[] {
  return Object.entries(GRADE_LEVEL_TO_GROUP)
    .filter(([, g]) => g === group)
    .map(([name]) => name);
}
