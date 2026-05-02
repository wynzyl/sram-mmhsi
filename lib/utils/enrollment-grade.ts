/**
 * Validates that a new enrollment grade is strictly above prior enrollment grade
 * when progression is possible within the grade catalog.
 */
export function validateGradeProgression(args: {
  priorGradeOrder: number | null;
  newGradeOrder: number;
  maxCatalogOrder: number;
}): { ok: true } | { ok: false; message: string } {
  const { priorGradeOrder, newGradeOrder, maxCatalogOrder } = args;
  if (priorGradeOrder == null) return { ok: true };

  if (newGradeOrder < priorGradeOrder) {
    return {
      ok: false,
      message:
        "Selected grade level is lower than the student's previous enrollment. Choose a higher grade.",
    };
  }

  if (priorGradeOrder < maxCatalogOrder && newGradeOrder <= priorGradeOrder) {
    return {
      ok: false,
      message:
        "This student has a prior enrollment in another school year. The new grade level must be higher than that previous grade (e.g. Grade 7 → Grade 8).",
    };
  }

  if (priorGradeOrder >= maxCatalogOrder && newGradeOrder < priorGradeOrder) {
    return {
      ok: false,
      message: "Selected grade level cannot be below the student's previous enrollment.",
    };
  }

  return { ok: true };
}
