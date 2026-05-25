import "server-only";

import { db } from "@/lib/db";
import {
  assessments,
  students,
  schoolYears,
  enrollments,
  gradeLevels,
  schoolYearFeeSchedules,
  feeTemplateItems,
  feeScheduleOverrides,
  feeItemTypes,
} from "@/lib/db/schema";
import { eq, desc, asc, sql, and, isNull, or, ilike, type SQL } from "drizzle-orm";
import type { FeeAssessmentBand } from "@/lib/constants/assessment-bands";
import {
  type PaginationParams,
  type PaginatedResult,
  calculatePagination,
  calculateOffset,
} from "@/lib/types/pagination";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";

export type AssessmentListItem = {
  id: string;
  studentName: string;
  gradeLevel: string;
  schoolYear: string;
  totalAmount: number;
  totalPaid: number;
  balance: number;
  billingStatus: "outstanding" | "fully_paid" | "cancelled" | "balance_forwarded";
  transferredAt: Date | null;
};

/**
 * Billing status filter for assessments list.
 *
 * - `unpaid`: Assessed but no payments received (total_paid = 0, not cancelled/forwarded)
 * - `outstanding`: Partial payments made, balance remaining (balance > 0, total_paid > 0, status = outstanding)
 * - `paid`: Completely paid off (billing_status = fully_paid)
 * - `cancelled`: Cancelled assessments (billing_status = cancelled)
 * - `forwarded`: Balance forwarded to next school year (billing_status = balance_forwarded)
 */
export type AssessmentBillingFilter =
  | "unpaid"
  | "outstanding"
  | "paid"
  | "cancelled"
  | "forwarded";

/**
 * Parameters for querying assessments list.
 */
export type AssessmentListParams = PaginationParams & {
  /** Search by student first or last name (case-insensitive partial match) */
  searchQuery?: string;
  /** Filter by specific school year ID. Falls back to active school year if not provided. */
  schoolYearId?: string;
  /** Filter by billing status category */
  billingFilter?: AssessmentBillingFilter;
};

/**
 * Get paginated assessments list with optional search and school year filter.
 *
 * @param params - Pagination, search, and filter parameters
 * @returns Paginated list of assessments
 *
 * @example
 * ```ts
 * // Get assessments for active school year (default)
 * const result = await getAssessmentsList({ page: 1, pageSize: 25 });
 *
 * // Search by student name
 * const result = await getAssessmentsList({
 *   page: 1,
 *   pageSize: 25,
 *   searchQuery: "Santos",
 * });
 *
 * // Filter by specific school year
 * const result = await getAssessmentsList({
 *   page: 1,
 *   pageSize: 25,
 *   schoolYearId: "uuid-here",
 * });
 * ```
 */
/**
 * Build SQL condition for billing filter.
 */
function buildBillingFilterCondition(
  filter: AssessmentBillingFilter
): SQL | undefined {
  switch (filter) {
    case "unpaid":
      // Assessed but no payments received (total_paid = 0, not cancelled/forwarded)
      return and(
        eq(assessments.totalPaid, "0"),
        sql`${assessments.billingStatus} NOT IN ('cancelled', 'balance_forwarded')`
      );
    case "outstanding":
      // Partial payments made, balance remaining
      return and(
        sql`${assessments.balance} > 0`,
        sql`${assessments.totalPaid} > 0`,
        eq(assessments.billingStatus, "outstanding")
      );
    case "paid":
      // Completely paid off
      return eq(assessments.billingStatus, "fully_paid");
    case "cancelled":
      // Cancelled assessments
      return eq(assessments.billingStatus, "cancelled");
    case "forwarded":
      // Balance forwarded to next school year
      return eq(assessments.billingStatus, "balance_forwarded");
    default:
      return undefined;
  }
}

export async function getAssessmentsList(
  params: AssessmentListParams = { page: 1, pageSize: 25 }
): Promise<PaginatedResult<AssessmentListItem>> {
  const { page, pageSize, searchQuery, schoolYearId, billingFilter } = params;
  const offset = calculateOffset(page, pageSize);

  // Build WHERE conditions array
  const conditions: SQL[] = [];

  // School year filter: use provided ID or fall back to active
  if (schoolYearId) {
    conditions.push(eq(assessments.schoolYearId, schoolYearId));
  } else {
    const activeSchoolYear = await getActiveSchoolYear();
    if (!activeSchoolYear) {
      return {
        data: [],
        pagination: calculatePagination(page, pageSize, 0),
      };
    }
    conditions.push(eq(assessments.schoolYearId, activeSchoolYear.id));
  }

  // Search filter: match student first or last name (case-insensitive)
  if (searchQuery?.trim()) {
    const searchTerm = `%${searchQuery.trim()}%`;
    conditions.push(
      or(
        ilike(students.firstName, searchTerm),
        ilike(students.lastName, searchTerm)
      )!
    );
  }

  // Billing filter: filter by billing status category
  if (billingFilter) {
    const billingCondition = buildBillingFilterCondition(billingFilter);
    if (billingCondition) {
      conditions.push(billingCondition);
    }
  }

  // Combine all conditions with AND
  const whereClause = and(...conditions);

  // Get total count for pagination metadata
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .where(whereClause);

  const totalRecords = Number(countResult?.count ?? 0);

  // Get paginated data (join with enrollments and gradeLevels for grade level name)
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
      gradeLevel: gradeLevels.name,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(whereClause)
    .orderBy(asc(students.lastName), asc(students.firstName))
    .limit(pageSize)
    .offset(offset);

  const data = rows.map(
    (r): AssessmentListItem => ({
      id: r.id,
      studentName: `${r.studentLastName}, ${r.studentFirstName}`,
      gradeLevel: r.gradeLevel,
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

/**
 * Counts for each assessment billing filter category.
 */
export type AssessmentTabCounts = {
  unpaid: number;
  outstanding: number;
  paid: number;
  cancelled: number;
  forwarded: number;
};

/**
 * Get counts for all assessment billing filter categories.
 * Used to display badge counts in the tab navigation.
 *
 * @param schoolYearId - Optional school year ID (defaults to active)
 * @returns Counts for each billing filter category
 */
export async function getAssessmentTabCounts(
  schoolYearId?: string
): Promise<AssessmentTabCounts> {
  // Determine school year to use
  let syId = schoolYearId;
  if (!syId) {
    const activeSchoolYear = await getActiveSchoolYear();
    if (!activeSchoolYear) {
      return { unpaid: 0, outstanding: 0, paid: 0, cancelled: 0, forwarded: 0 };
    }
    syId = activeSchoolYear.id;
  }

  // Single query with CASE expressions for all counts
  const [result] = await db
    .select({
      unpaid: sql<number>`SUM(CASE WHEN ${assessments.totalPaid} = 0 AND ${assessments.billingStatus} NOT IN ('cancelled', 'balance_forwarded') THEN 1 ELSE 0 END)`,
      outstanding: sql<number>`SUM(CASE WHEN ${assessments.balance} > 0 AND ${assessments.totalPaid} > 0 AND ${assessments.billingStatus} = 'outstanding' THEN 1 ELSE 0 END)`,
      paid: sql<number>`SUM(CASE WHEN ${assessments.billingStatus} = 'fully_paid' THEN 1 ELSE 0 END)`,
      cancelled: sql<number>`SUM(CASE WHEN ${assessments.billingStatus} = 'cancelled' THEN 1 ELSE 0 END)`,
      forwarded: sql<number>`SUM(CASE WHEN ${assessments.billingStatus} = 'balance_forwarded' THEN 1 ELSE 0 END)`,
    })
    .from(assessments)
    .where(eq(assessments.schoolYearId, syId));

  return {
    unpaid: Number(result?.unpaid ?? 0),
    outstanding: Number(result?.outstanding ?? 0),
    paid: Number(result?.paid ?? 0),
    cancelled: Number(result?.cancelled ?? 0),
    forwarded: Number(result?.forwarded ?? 0),
  };
}

// ─── Fee Schedule Resolution ─────────────────────────────────────────────

type DbQuery = typeof db.query;

export type ResolvedFeeItem = {
  feeTemplateItemId: string;
  feeItemTypeId: string; // For populating assessment_items.fee_item_type_id
  feeItemTypeCode: string; // For discount base calculation (e.g., 'TUITION')
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
    where: and(
      eq(feeTemplateItems.feeTemplateId, schedule.feeTemplateId),
      isNull(feeTemplateItems.deletedAt)
    ),
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
    feeItemTypeCode: item.feeItemType.code, // For discount base calculation
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
