import { db } from "@/lib/db";
import { feeSchedules } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { FeeAssessmentBand } from "@/lib/fee-schedule/bands";

type DbQuery = typeof db.query;

/**
 * Band-specific fee schedule for a school year, or legacy school-wide row (assessment_band IS NULL).
 */
export async function resolveFeeScheduleForAssessment(
  executor: { query: DbQuery },
  params: { schoolYearId: string; assessmentBand: FeeAssessmentBand }
): Promise<{ id: string; isActive: boolean } | null> {
  const { schoolYearId, assessmentBand } = params;

  const bandRow = await executor.query.feeSchedules.findFirst({
    where: and(
      eq(feeSchedules.schoolYearId, schoolYearId),
      eq(feeSchedules.assessmentBand, assessmentBand)
    ),
    columns: { id: true, isActive: true },
  });
  if (bandRow) return bandRow;

  const legacy = await executor.query.feeSchedules.findFirst({
    where: and(eq(feeSchedules.schoolYearId, schoolYearId), isNull(feeSchedules.assessmentBand)),
    columns: { id: true, isActive: true },
  });
  return legacy ?? null;
}
