import 'server-only';
import "server-only";

import { db } from "@/lib/db";
import {
  assessments,
  students,
  schoolYears,
  schoolYearFeeSchedules,
  feeTemplateItems,
  feeScheduleOverrides,
  feeItemTypes,
} from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import type { FeeAssessmentBand } from "@/lib/constants/assessment-bands";
import {
  type PaginationParams,
  type PaginatedResult,
  calculatePagination,
  calculateOffset,
} from "@/lib/types/pagination";

export type AssessmentListItem = {
  id: string;
  studentName: string;
  schoolYear: string;
  totalAmount: number;
  totalPaid: number;
  balance: number;
  billingStatus: "outstanding" | "fully_paid" | "cancelled";
  transferredAt: Date | null;
};

/**
 * Get paginated assessments list.
 * Default page size: 25 records per page.
 */
export async function getAssessmentsList(
  params: PaginationParams = { page: 1, pageSize: 25 }
): Promise<PaginatedResult<AssessmentListItem>> {
  const { page, pageSize } = params;
  const offset = calculateOffset(page, pageSize);

  // Get total count for pagination metadata
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(assessments);

  const totalRecords = Number(countResult?.count ?? 0);

  // Get paginated data
  const rows = await db
    .select({
      id: assessments.id,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
      transferredAt: assessments.transferredAt,
      studentLastName: students.lastName,
      studentFirstName: students.firstName,
      schoolYear: schoolYears.label,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .orderBy(desc(assessments.createdAt))
    .limit(pageSize)
    .offset(offset);

  const data = rows.map(
    (r): AssessmentListItem => ({
      id: r.id,
      studentName: `${r.studentLastName}, ${r.studentFirstName}`,
      schoolYear: r.schoolYear,
      totalAmount: Number(r.totalAmount),
      totalPaid: Number(r.totalPaid),
      balance: Number(r.balance),
      billingStatus: r.billingStatus,
      transferredAt: r.transferredAt,
    })
  );

  return {
    data,
    pagination: calculatePagination(page, pageSize, totalRecords),
  };
}

// ─── Fee Schedule Resolution ─────────────────────────────────────────────

type DbQuery = typeof db.query;

export type ResolvedFeeItem = {
  feeTemplateItemId: string;
  feeItemTypeId: string; // For populating assessment_items.fee_item_type_id
  description: string; // From fee_item_types.name
  amount: string;
  isDiscount: boolean; // From fee_item_types.is_discount
  order: number;
};

export type FeeScheduleResolution = {
  scheduleId: string;
  feeTemplateId: string;
  items: ResolvedFeeItem[];
} | null;

/**
 * Resolves the active fee schedule for a school year + assessment band.
 *
 * @param executor - Database query executor (db or transaction)
 * @param params - School year ID and assessment band
 * @returns Resolved fee schedule with items (including overrides), or null if not found
 *
 * @example
 * ```ts
 * const resolution = await resolveFeeScheduleForAssessment(db, {
 *   schoolYearId: "uuid",
 *   assessmentBand: "casa",
 * });
 *
 * if (!resolution) {
 *   throw new Error("No fee schedule configured");
 * }
 *
 * // Use resolved items to create assessment
 * await db.insert(assessmentItems).values(
 *   resolution.items.map(item => ({
 *     assessmentId: assessment.id,
 *     feeTemplateItemId: item.feeTemplateItemId,
 *     feeItemTypeId: item.feeItemTypeId,
 *     description: item.description,
 *     amount: item.amount,
 *     isDiscount: item.isDiscount,
 *   }))
 * );
 * ```
 */
export async function resolveFeeScheduleForAssessment(
  executor: { query: DbQuery },
  params: {
    schoolYearId: string;
    assessmentBand: FeeAssessmentBand;
  }
): Promise<FeeScheduleResolution> {
  const { schoolYearId, assessmentBand } = params;

  // ─── Step 1: Find Active Schedule ────────────────────────────────────────

  const schedule = await executor.query.schoolYearFeeSchedules.findFirst({
    where: and(
      eq(schoolYearFeeSchedules.schoolYearId, schoolYearId),
      eq(schoolYearFeeSchedules.assessmentBand, assessmentBand),
      eq(schoolYearFeeSchedules.isActive, true)
    ),
    orderBy: (t, { desc }) => [desc(t.effectiveDate)],
  });

  if (!schedule) {
    return null;
  }

  // ─── Step 2: Load Template Items with Fee Type Details ───────────────────

  const templateItems = await executor.query.feeTemplateItems.findMany({
    where: eq(feeTemplateItems.feeTemplateId, schedule.feeTemplateId),
    with: {
      feeItemType: true, // Join with fee_item_types to get name/description
    },
    orderBy: (t, { asc }) => [asc(t.order), asc(t.createdAt)],
  });

  if (templateItems.length === 0) {
    return null;
  }

  // ─── Step 3: Load Overrides for This Schedule ────────────────────────────

  const overrides = await executor.query.feeScheduleOverrides.findMany({
    where: eq(feeScheduleOverrides.scheduleId, schedule.id),
  });

  const overrideMap = new Map(
    overrides.map((o) => [o.feeTemplateItemId, o.overrideAmount])
  );

  // ─── Step 4: Merge Template Items with Overrides ─────────────────────────

  const resolvedItems: ResolvedFeeItem[] = templateItems.map((item) => ({
    feeTemplateItemId: item.id,
    feeItemTypeId: item.feeItemTypeId, // For assessment_items reporting
    description: item.feeItemType.name, // Get name from fee_item_types
    amount: overrideMap.has(item.id)
      ? String(overrideMap.get(item.id))
      : item.defaultAmount,
    isDiscount: item.feeItemType.isDiscount, // Get from fee_item_types
    order: item.order,
  }));

  return {
    scheduleId: schedule.id,
    feeTemplateId: schedule.feeTemplateId,
    items: resolvedItems,
  };
}
