/**
 * Grading system types - configurable per school year.
 * Determines which grading periods are valid for that year.
 */
export const GRADING_SYSTEM_TYPES = ["quarterly", "trimester"] as const;

export type GradingSystemType = (typeof GRADING_SYSTEM_TYPES)[number];

export const GRADING_SYSTEM_LABELS: Record<GradingSystemType, string> = {
  quarterly: "Quarterly (Q1-Q4)",
  trimester: "Trimester (T1-T3)",
};

/**
 * Get valid periods for a grading system type.
 */
export function getValidPeriods(systemType: GradingSystemType): readonly string[] {
  switch (systemType) {
    case "quarterly":
      return ["Q1", "Q2", "Q3", "Q4"];
    case "trimester":
      return ["T1", "T2", "T3"];
    default:
      return [];
  }
}

/**
 * Check if a grading period is valid for a system type.
 */
export function isValidPeriod(period: string, systemType: GradingSystemType): boolean {
  return getValidPeriods(systemType).includes(period);
}
