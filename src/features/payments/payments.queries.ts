import "server-only";
import { db } from "@/lib/db";
import {
  assessments,
  assessmentItems,
  discountTypes,
  enrollments,
  feeItemTypes,
  gradeLevels,
  payments,
  receiptBooklets,
  schoolYears,
  studentDiscounts,
  students,
  users,
} from "@/lib/db/schema";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, notInArray, sql } from "drizzle-orm";
import { parseOrNumber } from "@/lib/utils/or-number";
import type { DbExecutor } from "@/lib/utils/tx-helpers";
import type { Role } from "@/lib/constants/roles";
import { FULL_PAYMENT_DISCOUNT_CODE } from "@/lib/constants/discount-codes";
import { getPortalStudentIds, getPortalStudentLabels } from "@/lib/queries/portal-student";
import { calculateOffset } from "@/lib/types/pagination";
import { roundToTwoDecimals } from "@/lib/utils/currency";
import {
  calculateDiscountBase,
  calculateDiscountAmount,
} from "@/features/discounts/utils/discount-calculations";
import {
  generateCascadePreview,
  type StudentDiscountForCascade,
} from "@/features/discounts/utils/cascade-calculations";
import { formatDate } from "@/lib/utils/date";

// ─────────────────────────────────────────────────────────────────
// Types (re-exported from payments.types.ts)
// ─────────────────────────────────────────────────────────────────

export type {
  CashierQueueRow,
  CashierStats,
  RecentCollection,
  CashierQueueData,
  CashierQueueParams,
  PortalPaymentRow,
  PortalPaymentsData,
  ManualEntrySuggestions,
  CashDiscountEligibility,
  CascadeAdjustmentPreview,
  CascadeAdjustmentPreviewLine,
  AppliedCashDiscountDetails,
  AppliedCascadeAdjustment,
  RelatedTuitionDiscount,
  CascadeFixNeeded,
  CascadeFixAdjustment,
  CascadeFixFormState,
} from "./payments.types";

import type {
  CashierQueueRow,
  CashierStats,
  RecentCollection,
  CashierQueueData,
  CashierQueueParams,
  PortalPaymentRow,
  PortalPaymentsData,
  ManualEntrySuggestions,
  CashDiscountEligibility,
  CascadeAdjustmentPreview,
  AppliedCashDiscountDetails,
  AppliedCascadeAdjustment,
  RelatedTuitionDiscount,
  CascadeFixNeeded,
  CascadeFixAdjustment,
} from "./payments.types";

// ─────────────────────────────────────────────────────────────────
// Query helpers
// ─────────────────────────────────────────────────────────────────

/**
 * SQL predicate matching payments whose `paymentDate` falls on "today".
 * Uses a half-open range (`>= CURRENT_DATE` and `< CURRENT_DATE + 1 day`)
 * instead of `DATE()` so the paymentDate index can be used. Centralized so
 * the definition of "today" only needs to change in one place.
 */
function paymentDateIsToday() {
  return [
    gte(payments.paymentDate, sql`CURRENT_DATE`),
    lt(payments.paymentDate, sql`CURRENT_DATE + INTERVAL '1 day'`),
  ] as const;
}

// ─────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch all data needed for the cashier queue page.
 * Includes pagination to prevent memory issues with large datasets.
 * @param params.page - Page number (1-indexed), defaults to 1
 * @param params.pageSize - Number of items per page, defaults to 50, max 100
 */
export async function fetchCashierQueueData(
  params: CashierQueueParams = {}
): Promise<CashierQueueData> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = calculateOffset(page, pageSize);
  const [
    todayTotalRow,
    totalCollectiblesRow,
    studentAssessedRow,
    queueCountRow,
    rows,
    recentCollections,
  ] = await Promise.all([
    // Today's total collections
    db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
      })
      .from(payments)
      .where(
        and(eq(payments.status, "posted"), ...paymentDateIsToday())
      )
      .then((r) => r[0]),

    // Total collectibles (outstanding balances)
    db
      .select({
        total: sql<string>`COALESCE(SUM(${assessments.balance}::numeric), 0)`,
      })
      .from(assessments)
      .where(
        and(
          eq(assessments.billingStatus, "outstanding"),
          sql`${assessments.balance}::numeric > 0`
        )
      )
      .then((r) => r[0]),

    // Total students assessed
    db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(assessments)
      .where(sql`${assessments.billingStatus} != 'cancelled'`)
      .then((r) => r[0]),

    // Count of outstanding assessments for pagination
    db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(assessments)
      .where(
        and(
          eq(assessments.billingStatus, "outstanding"),
          sql`${assessments.balance}::numeric > 0`
        )
      )
      .then((r) => r[0]),

    // Queue of pending payments (paginated)
    db
      .select({
        assessmentId: assessments.id,
        balance: assessments.balance,
        totalPaid: assessments.totalPaid,
        billingStatus: assessments.billingStatus,
        schoolYear: schoolYears.label,
        gradeLevel: gradeLevels.name,
        referenceNumber: students.referenceNumber,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        updatedAt: assessments.updatedAt,
        createdAt: assessments.createdAt,
      })
      .from(assessments)
      .innerJoin(students, eq(assessments.studentId, students.id))
      .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
      .where(
        and(
          eq(assessments.billingStatus, "outstanding"),
          sql`${assessments.balance}::numeric > 0`
        )
      )
      .orderBy(desc(assessments.updatedAt), desc(assessments.createdAt))
      .limit(pageSize)
      .offset(offset),

    // Recent collections today
    db
      .select({
        paymentId: payments.id,
        orNumber: payments.orNumber,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        assessmentId: payments.assessmentId,
      })
      .from(payments)
      .innerJoin(students, eq(payments.studentId, students.id))
      .where(
        and(eq(payments.status, "posted"), ...paymentDateIsToday())
      )
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      .limit(20),
  ]);

  const queueTotalCount = Number(queueCountRow?.count ?? 0);

  const queue: CashierQueueRow[] = rows.map((r) => ({
    assessmentId: r.assessmentId,
    studentName: `${r.studentLastName}, ${r.studentFirstName}`,
    referenceNumber: r.referenceNumber,
    gradeLevel: r.gradeLevel,
    schoolYear: r.schoolYear,
    billingStatus: r.billingStatus,
    balance: Number(r.balance),
    totalPaid: Number(r.totalPaid),
  }));

  const stats: CashierStats = {
    totalCollectedToday: Number(todayTotalRow?.total ?? 0),
    pendingPaymentsCount: queueTotalCount, // Use total count, not page count
    studentsAssessed: Number(studentAssessedRow?.count ?? 0),
    totalCollectibles: Number(totalCollectiblesRow?.total ?? 0),
  };

  const formattedRecentCollections: RecentCollection[] = recentCollections.map(
    (p) => ({
      paymentId: p.paymentId,
      orNumber: p.orNumber,
      amount: Number(p.amount),
      paymentDate: p.paymentDate,
      studentFirstName: p.studentFirstName,
      studentLastName: p.studentLastName,
      assessmentId: p.assessmentId,
    })
  );

  return {
    queue,
    stats,
    recentCollections: formattedRecentCollections,
    queueTotalCount,
  };
}

// ─────────────────────────────────────────────────────────────────
// Portal payments (student / parent read-only history)
// ─────────────────────────────────────────────────────────────────

/**
 * Read-only payment history for a portal user (student or parent/guardian).
 * Not cached — financial data must always be current.
 */
export async function getPortalPayments(
  userId: string,
  role: Role
): Promise<PortalPaymentsData> {
  const studentIds = await getPortalStudentIds(userId, role);
  if (studentIds.length === 0) {
    return { rows: [], showStudentColumn: false, hasLinkedStudents: false };
  }

  const labels = await getPortalStudentLabels(studentIds);
  const labelMap = new Map(labels.map((s) => [s.id, s]));

  const paymentRows = await db
    .select({
      id: payments.id,
      studentId: payments.studentId,
      orNumber: payments.orNumber,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      paymentDate: payments.paymentDate,
      status: payments.status,
      referenceNumber: payments.referenceNumber,
    })
    .from(payments)
    .where(inArray(payments.studentId, studentIds))
    .orderBy(desc(payments.paymentDate));

  const rows: PortalPaymentRow[] = paymentRows.map((r) => {
    const who = labelMap.get(r.studentId);
    return {
      id: r.id,
      studentId: r.studentId,
      studentName: who ? `${who.lastName}, ${who.firstName}` : "—",
      studentReference: who?.referenceNumber ?? null,
      orNumber: r.orNumber,
      amount: Number(r.amount),
      paymentMethod: r.paymentMethod,
      paymentDate: r.paymentDate.toISOString(),
      status: r.status,
      paymentReference: r.referenceNumber,
    };
  });

  return { rows, showStudentColumn: studentIds.length > 1, hasLinkedStudents: true };
}

// ─────────────────────────────────────────────────────────────────
// Booklet Assignment & Manual Entry Suggestions
// ─────────────────────────────────────────────────────────────────

/**
 * Get users who can be assigned booklets (registrar, cashier, admin) for booklet assignment dropdown.
 */
export async function getCashiersForBookletAssignment(): Promise<
  { id: string; username: string; email: string }[]
> {
  return db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        inArray(users.role, ["registrar", "cashier", "admin"]),
        isNull(users.deletedAt)
      )
    )
    .orderBy(asc(users.username));
}

/**
 * Get the default booklet ID for a cashier (used to pre-select in payment form).
 */
export async function getCashierDefaultBookletId(userId: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { defaultBookletId: true },
  });
  return user?.defaultBookletId ?? null;
}

/**
 * Get suggestions for manual payment entry.
 * Returns the last manual payment date and next available OR numbers from manual_only booklets.
 *
 * Access control: suggestions exclude manual_only booklets assigned to OTHER users,
 * mirroring getAccessibleBookletsForUser() for auto_only booklets. Assigned booklets
 * are exclusive to their assigned user; unassigned booklets can be used by anyone.
 */
export async function getManualEntrySuggestions(
  userId: string
): Promise<ManualEntrySuggestions> {
  // 1. Get most recent manual payment date
  const lastManual = await db
    .select({ paymentDate: payments.paymentDate })
    .from(payments)
    .where(eq(payments.isManualEntry, true))
    .orderBy(desc(payments.paymentDate))
    .limit(1);

  const lastManualPaymentDate = lastManual[0]?.paymentDate
    ? lastManual[0].paymentDate.toISOString().split("T")[0]
    : null;

  // 2. Get active manual_only booklets accessible to this user
  //    (own assigned + unassigned; exclude booklets assigned to others)
  const excludedIds = await getBookletIdsAssignedToOthers(userId);

  const manualBooklets = await db
    .select({
      id: receiptBooklets.id,
      series: receiptBooklets.series,
      prefix: receiptBooklets.prefix,
      startNumber: receiptBooklets.startNumber,
      endNumber: receiptBooklets.endNumber,
      nextNumber: receiptBooklets.nextNumber,
    })
    .from(receiptBooklets)
    .where(
      and(
        eq(receiptBooklets.status, "active"),
        eq(receiptBooklets.usageMode, "manual_only"),
        excludedIds.length > 0
          ? notInArray(receiptBooklets.id, excludedIds)
          : undefined
      )
    )
    .orderBy(asc(receiptBooklets.createdAt));

  // 3. Batch-fetch all consumed OR numbers for every manual booklet in one query
  //    (avoids an N+1 query per booklet), then group the sequences by booklet.
  const consumedBySequence = new Map<string, Set<number>>();
  const bookletIds = manualBooklets.map((b) => b.id);

  if (bookletIds.length > 0) {
    const consumedOrs = await db
      .select({ bookletId: payments.bookletId, orNumber: payments.orNumber })
      .from(payments)
      .where(
        and(
          inArray(payments.bookletId, bookletIds),
          sql`${payments.orNumber} IS NOT NULL`
        )
      );

    for (const row of consumedOrs) {
      if (!row.bookletId || !row.orNumber) continue;
      const parsed = parseOrNumber(row.orNumber);
      if (!parsed) continue;
      let set = consumedBySequence.get(row.bookletId);
      if (!set) {
        set = new Set<number>();
        consumedBySequence.set(row.bookletId, set);
      }
      set.add(parsed.sequence);
    }
  }

  // 4. For each booklet, compute next available OR number from the grouped set
  const suggestedOrNumbers: { bookletId: string; series: string; nextOr: string }[] = [];

  for (const booklet of manualBooklets) {
    const consumedSet = consumedBySequence.get(booklet.id) ?? new Set<number>();

    // Find the next available OR number in sequence
    let nextAvailable = booklet.nextNumber;
    while (nextAvailable <= booklet.endNumber && consumedSet.has(nextAvailable)) {
      nextAvailable++;
    }

    // If there's an available OR in this booklet
    if (nextAvailable <= booklet.endNumber) {
      const paddedNum = String(nextAvailable).padStart(5, "0");
      suggestedOrNumbers.push({
        bookletId: booklet.id,
        series: booklet.series,
        nextOr: `${booklet.prefix} ${paddedNum}`,
      });
    }
  }

  return { lastManualPaymentDate, suggestedOrNumbers };
}

// ─────────────────────────────────────────────────────────────────
// Booklet Access Control
// ─────────────────────────────────────────────────────────────────

/**
 * Get all booklet IDs that are assigned to users OTHER than the current user.
 * Used to filter out booklets that the current user cannot access.
 *
 * Business Rule: Assigned booklets can ONLY be consumed by the assigned user.
 * Unassigned booklets (not in any user's defaultBookletId) can be used by anyone.
 */
export async function getBookletIdsAssignedToOthers(currentUserId: string): Promise<string[]> {
  const assignedToOthers = await db
    .select({ defaultBookletId: users.defaultBookletId })
    .from(users)
    .where(
      and(
        sql`${users.defaultBookletId} IS NOT NULL`,
        ne(users.id, currentUserId),
        isNull(users.deletedAt)
      )
    );

  return assignedToOthers
    .map((u) => u.defaultBookletId)
    .filter((id): id is string => id !== null);
}

/**
 * Get active auto_only booklets that a user can access:
 * - Their own assigned booklet (if any)
 * - Unassigned booklets (not in any user's defaultBookletId)
 *
 * This enforces the business rule that assigned booklets are exclusive
 * to their assigned user.
 */
export async function getAccessibleBookletsForUser(userId: string): Promise<
  {
    id: string;
    series: string;
    prefix: string;
    nextNumber: number;
    endNumber: number;
  }[]
> {
  const excludedIds = await getBookletIdsAssignedToOthers(userId);

  return db
    .select({
      id: receiptBooklets.id,
      series: receiptBooklets.series,
      prefix: receiptBooklets.prefix,
      nextNumber: receiptBooklets.nextNumber,
      endNumber: receiptBooklets.endNumber,
    })
    .from(receiptBooklets)
    .where(
      and(
        eq(receiptBooklets.status, "active"),
        eq(receiptBooklets.usageMode, "auto_only"),
        lte(receiptBooklets.nextNumber, receiptBooklets.endNumber),
        excludedIds.length > 0
          ? notInArray(receiptBooklets.id, excludedIds)
          : undefined
      )
    )
    .orderBy(asc(receiptBooklets.createdAt));
}

// ─────────────────────────────────────────────────────────────────
// Payment Void Ordering
//
// Enforces the accounting rule that payments must be voided in reverse
// chronological order. Only the most recent posted payment for an
// assessment can be voided at any given time.
// ─────────────────────────────────────────────────────────────────

/**
 * Result of querying the most recent voidable payment.
 */
interface MostRecentVoidableRow {
  id: string;
}

/**
 * Get the most recent voidable payment ID for an assessment.
 *
 * A "voidable" payment is one with:
 * - kind = 'payment' (not a reversal or balance_forward)
 * - status = 'posted'
 *
 * Payments are ordered by createdAt DESC, so the first result is the most recent.
 *
 * @param assessmentId - Assessment to check
 * @param executor - Database executor (transaction or db)
 * @returns Payment ID of the most recent voidable payment, or null if none
 */
export async function getMostRecentVoidablePaymentId(
  assessmentId: string,
  executor: DbExecutor = db
): Promise<string | null> {
  const result = await executor.execute(sql`
    SELECT id
    FROM payments
    WHERE assessment_id = ${assessmentId}
      AND kind = 'payment'
      AND status = 'posted'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const rows = result as MostRecentVoidableRow[];
  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Check if a specific payment is the most recent voidable payment.
 *
 * Used for server-side validation before creating void requests.
 * Ensures payments are voided in reverse chronological order.
 *
 * @param paymentId - Payment to check
 * @param assessmentId - Assessment the payment belongs to
 * @param executor - Database executor (transaction or db)
 * @returns true if the payment is the most recent voidable, false otherwise
 */
export async function isPaymentMostRecentVoidable(
  paymentId: string,
  assessmentId: string,
  executor: DbExecutor = db
): Promise<boolean> {
  const mostRecentId = await getMostRecentVoidablePaymentId(assessmentId, executor);
  return mostRecentId === paymentId;
}

// ─────────────────────────────────────────────────────────────────
// Full Payment Cash Discount Eligibility
// ─────────────────────────────────────────────────────────────────

/**
 * Check if a payment qualifies for the full payment cash discount.
 *
 * Eligibility conditions:
 * 1. Payment amount >= assessment balance (full payment)
 * 2. Today < school year's cashDiscountCutoffDate
 * 3. Student does NOT already have FULL_PAYMENT_DISCOUNT on this assessment
 * 4. Assessment is not cancelled or transferred
 * 5. FULL_PAYMENT_DISCOUNT type exists and is active in discountTypes
 *
 * PERFORMANCE: After initial assessment validation, runs 4 queries in parallel
 * (discount type, existing discount, assessment items, tuition discounts).
 *
 * @param assessmentId - Assessment to check
 * @param paymentAmount - Amount the student is paying
 * @returns Eligibility status with discount details if eligible
 */
export async function checkFullPaymentCashDiscountEligibility(
  assessmentId: string,
  paymentAmount: number
): Promise<CashDiscountEligibility> {
  // 1. Fetch assessment with enrollment -> school year -> cutoff date
  // This MUST run first for validation before other queries
  const [assessmentRow] = await db
    .select({
      id: assessments.id,
      balance: assessments.balance,
      totalAmount: assessments.totalAmount,
      cancelledAt: assessments.cancelledAt,
      transferredAt: assessments.transferredAt,
      enrollmentId: assessments.enrollmentId,
      cashDiscountCutoffDate: schoolYears.cashDiscountCutoffDate,
      schoolYearLabel: schoolYears.label,
      schoolYearIsActive: schoolYears.isActive,
      schoolYearStartDate: schoolYears.startDate,
    })
    .from(assessments)
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!assessmentRow) {
    return { eligible: false, reason: "Assessment not found." };
  }

  // 2. Check assessment is not cancelled or transferred
  if (assessmentRow.cancelledAt) {
    return { eligible: false, reason: "Assessment is cancelled." };
  }
  if (assessmentRow.transferredAt) {
    return { eligible: false, reason: "Assessment balance was transferred." };
  }

  // 2b. Check assessment is for the ACTIVE school year
  if (!assessmentRow.schoolYearIsActive) {
    return {
      eligible: false,
      reason: `Cash discount is only available for the active school year. This assessment is for ${assessmentRow.schoolYearLabel}.`,
    };
  }

  const balance = Number(assessmentRow.balance);

  // 3. Check payment amount = full balance (using small epsilon for floating point)
  const BALANCE_EPSILON = 0.01;
  if (paymentAmount < balance - BALANCE_EPSILON) {
    return { eligible: false, reason: "Payment amount is less than full balance." };
  }

  // 4. Check cutoff date exists and today is before it
  if (!assessmentRow.cashDiscountCutoffDate) {
    return {
      eligible: false,
      reason: `No cash discount cutoff date configured for ${assessmentRow.schoolYearLabel}.`,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoffDate = new Date(assessmentRow.cashDiscountCutoffDate);
  cutoffDate.setHours(0, 0, 0, 0);

  if (today >= cutoffDate) {
    return {
      eligible: false,
      reason: `Cash discount cutoff date (${formatDate(cutoffDate)}) has passed.`,
    };
  }

  // 4b. Check today is on or after school year start date
  const startDate = new Date(assessmentRow.schoolYearStartDate);
  startDate.setHours(0, 0, 0, 0);

  if (today < startDate) {
    return {
      eligible: false,
      reason: `Cash discount eligibility begins on ${formatDate(startDate)}. School year has not started yet.`,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PERFORMANCE OPTIMIZATION: Run 4 independent queries in parallel
  // These queries don't depend on each other, only on assessmentId
  // ─────────────────────────────────────────────────────────────────
  const [
    discountTypeResult,
    existingDiscountResult,
    assessmentItemRows,
    existingTuitionDiscounts,
  ] = await Promise.all([
    // Query 1: Check FULL_PAYMENT_DISCOUNT type exists and is active
    db
      .select({
        id: discountTypes.id,
        name: discountTypes.name,
        calculationType: discountTypes.calculationType,
        baseType: discountTypes.baseType,
        defaultValue: discountTypes.defaultValue,
        isActive: discountTypes.isActive,
      })
      .from(discountTypes)
      .where(
        and(
          eq(discountTypes.code, FULL_PAYMENT_DISCOUNT_CODE),
          isNull(discountTypes.deletedAt)
        )
      )
      .limit(1),

    // Query 2: Check student doesn't already have FULL_PAYMENT_DISCOUNT
    db
      .select({ id: studentDiscounts.id })
      .from(studentDiscounts)
      .where(
        and(
          eq(studentDiscounts.assessmentId, assessmentId),
          eq(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE),
          isNull(studentDiscounts.reversedAt)
        )
      )
      .limit(1),

    // Query 3: Fetch assessment items for base calculation
    db
      .select({
        id: assessmentItems.id,
        amount: assessmentItems.amount,
        isDiscount: assessmentItems.isDiscount,
        feeItemTypeCode: feeItemTypes.code,
      })
      .from(assessmentItems)
      .leftJoin(feeItemTypes, eq(assessmentItems.feeItemTypeId, feeItemTypes.id))
      .where(eq(assessmentItems.assessmentId, assessmentId)),

    // Query 4: Fetch existing tuition_only discounts for cascade preview
    db
      .select({
        id: studentDiscounts.id,
        studentId: studentDiscounts.studentId,
        assessmentId: studentDiscounts.assessmentId,
        discountTypeCode: studentDiscounts.discountTypeCode,
        discountTypeName: studentDiscounts.discountTypeName,
        calculationType: studentDiscounts.calculationType,
        baseType: studentDiscounts.baseType,
        baseAmount: studentDiscounts.baseAmount,
        discountValue: studentDiscounts.discountValue,
        discountAmount: studentDiscounts.discountAmount,
        assessmentItemId: studentDiscounts.assessmentItemId,
        cascadeAdjustmentAmount: studentDiscounts.cascadeAdjustmentAmount,
      })
      .from(studentDiscounts)
      .where(
        and(
          eq(studentDiscounts.assessmentId, assessmentId),
          eq(studentDiscounts.baseType, "tuition_only"),
          isNull(studentDiscounts.reversedAt),
          ne(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE)
        )
      ),
  ]);

  // Extract results from parallel queries
  const [discountType] = discountTypeResult;
  const [existingDiscount] = existingDiscountResult;

  // 5. Validate discount type
  if (!discountType) {
    return {
      eligible: false,
      reason: "Full payment cash discount is not configured in the system.",
    };
  }

  if (!discountType.isActive) {
    return {
      eligible: false,
      reason: "Full payment cash discount is currently disabled.",
    };
  }

  // 6. Check for existing discount
  if (existingDiscount) {
    return {
      eligible: false,
      reason: "Student already has a full payment cash discount on this assessment.",
    };
  }

  // 7. Calculate discount amount using parallel-fetched items
  const items = assessmentItemRows.map((r) => ({
    id: r.id,
    amount: r.amount,
    isDiscount: r.isDiscount,
    feeItemTypeCode: r.feeItemTypeCode,
  }));

  const baseAmount = calculateDiscountBase(items, discountType.baseType);
  const discountValue = Number(discountType.defaultValue);
  const cashDiscountAmount = calculateDiscountAmount(
    baseAmount,
    discountType.calculationType,
    discountValue
  );

  if (cashDiscountAmount <= 0) {
    return {
      eligible: false,
      reason: "Calculated discount amount is zero.",
    };
  }

  // Convert to cascade calculation format
  const discountsForCascade: StudentDiscountForCascade[] =
    existingTuitionDiscounts.map((d) => ({
      id: d.id,
      studentId: d.studentId,
      assessmentId: d.assessmentId,
      discountTypeCode: d.discountTypeCode,
      discountTypeName: d.discountTypeName,
      calculationType: d.calculationType as "fixed_amount" | "percentage",
      baseType: d.baseType as "tuition_only" | "full_assessment",
      baseAmount: d.baseAmount,
      discountValue: d.discountValue,
      discountAmount: d.discountAmount,
      assessmentItemId: d.assessmentItemId,
      cascadeAdjustmentAmount: d.cascadeAdjustmentAmount,
    }));

  // Generate cascade preview
  const cascadePreview = generateCascadePreview(
    discountsForCascade,
    cashDiscountAmount,
    items
  );

  // Calculate final balance including cascade adjustments
  // New balance = current balance - cash discount + cascade adjustment
  // Round all currency values to 2 decimal places to avoid floating-point precision issues
  const effectiveBalance = roundToTwoDecimals(
    Math.max(0, balance - cashDiscountAmount + cascadePreview.totalAdjustment)
  );
  const paymentRequired = effectiveBalance;

  // Build cascade preview for response (only if there are adjustments)
  let cascadeAdjustmentPreview: CascadeAdjustmentPreview | undefined;
  if (cascadePreview.hasCascadeAdjustments) {
    cascadeAdjustmentPreview = {
      hasCascadeAdjustments: true,
      lines: cascadePreview.lines.map((line) => ({
        discountTypeName: line.discountTypeName,
        originalAmount: roundToTwoDecimals(line.originalAmount),
        recalculatedAmount: roundToTwoDecimals(line.recalculatedAmount),
        adjustmentAmount: roundToTwoDecimals(line.adjustmentAmount),
      })),
      totalAdjustment: roundToTwoDecimals(cascadePreview.totalAdjustment),
      explanation: cascadePreview.explanation,
    };
  }

  return {
    eligible: true,
    discountDetails: {
      discountTypeId: discountType.id,
      discountTypeName: discountType.name,
      calculationType: discountType.calculationType,
      baseType: discountType.baseType,
      discountValue,
      baseAmount: roundToTwoDecimals(baseAmount),
      cashDiscountAmount: roundToTwoDecimals(cashDiscountAmount),
      currentBalance: roundToTwoDecimals(balance),
      newBalance: effectiveBalance,
      paymentRequired,
      cutoffDate,
      cascadePreview: cascadeAdjustmentPreview,
    },
  };
}

/**
 * Get discount type by code.
 * Used to fetch the FULL_PAYMENT_DISCOUNT config during payment posting.
 */
export async function getDiscountTypeByCode(
  code: string
): Promise<{
  id: string;
  code: string;
  name: string;
  calculationType: "fixed_amount" | "percentage";
  baseType: "tuition_only" | "full_assessment";
  defaultValue: string;
  isStackable: boolean;
} | null> {
  const [row] = await db
    .select({
      id: discountTypes.id,
      code: discountTypes.code,
      name: discountTypes.name,
      calculationType: discountTypes.calculationType,
      baseType: discountTypes.baseType,
      defaultValue: discountTypes.defaultValue,
      isStackable: discountTypes.isStackable,
    })
    .from(discountTypes)
    .where(
      and(
        eq(discountTypes.code, code),
        eq(discountTypes.isActive, true),
        isNull(discountTypes.deletedAt)
      )
    )
    .limit(1);

  return row ?? null;
}

// ─────────────────────────────────────────────────────────────────
// Applied Cash Discount Details (for payment page display)
// ─────────────────────────────────────────────────────────────────

/**
 * Get details of an already-applied cash discount on an assessment.
 *
 * Used to display read-only info on the payment page when the discount was
 * applied via the approval workflow (not at payment time). Returns cascade
 * adjustments that were triggered by the cash discount, as well as related
 * tuition-based discounts that were correctly applied on the discounted base.
 *
 * PERFORMANCE: After initial cash discount check, runs 4 queries in parallel
 * (assessment info, cascade adjustments, other discounts, applier). Then runs
 * 1 dependent query for school year info.
 *
 * @param assessmentId - Assessment to check
 * @returns Applied cash discount details, or null if no discount applied
 */
export async function getAppliedCashDiscountDetails(
  assessmentId: string
): Promise<AppliedCashDiscountDetails | null> {
  // 1. Check for existing non-reversed FULL_PAYMENT_DISCOUNT
  // This MUST run first - if no discount exists, we return early
  const [cashDiscount] = await db
    .select({
      id: studentDiscounts.id,
      discountAmount: studentDiscounts.discountAmount,
      baseAmount: studentDiscounts.baseAmount,
      appliedAt: studentDiscounts.appliedAt,
      appliedById: studentDiscounts.appliedBy,
    })
    .from(studentDiscounts)
    .where(
      and(
        eq(studentDiscounts.assessmentId, assessmentId),
        eq(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE),
        isNull(studentDiscounts.reversedAt)
      )
    )
    .limit(1);

  if (!cashDiscount) {
    return { hasAppliedCashDiscount: false };
  }

  // ─────────────────────────────────────────────────────────────────
  // PERFORMANCE OPTIMIZATION: Run 4 independent queries in parallel
  // These queries don't depend on each other (assessmentInfo, cascade,
  // other discounts, applier all use different lookup keys)
  // ─────────────────────────────────────────────────────────────────
  const [
    assessmentInfoResult,
    cascadeAdjustments,
    otherTuitionDiscounts,
    applierResult,
  ] = await Promise.all([
    // Query 1: Fetch assessment info for school year lookup
    db
      .select({
        schoolYearId: assessments.schoolYearId,
        totalPaid: assessments.totalPaid,
      })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1),

    // Query 2: Fetch cascade adjustments triggered by this discount
    db
      .select({
        discountTypeName: studentDiscounts.discountTypeName,
        originalAmount: studentDiscounts.discountAmount,
        adjustmentAmount: studentDiscounts.cascadeAdjustmentAmount,
      })
      .from(studentDiscounts)
      .where(
        and(
          eq(studentDiscounts.cascadeTriggeredByDiscountId, cashDiscount.id),
          isNull(studentDiscounts.reversedAt)
        )
      ),

    // Query 3: Fetch related tuition_only discounts (applied after cash discount)
    db
      .select({
        discountTypeName: studentDiscounts.discountTypeName,
        baseAmount: studentDiscounts.baseAmount,
        discountAmount: studentDiscounts.discountAmount,
      })
      .from(studentDiscounts)
      .where(
        and(
          eq(studentDiscounts.assessmentId, assessmentId),
          eq(studentDiscounts.baseType, "tuition_only"),
          ne(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE),
          isNull(studentDiscounts.reversedAt),
          isNull(studentDiscounts.cascadeTriggeredByDiscountId)
        )
      ),

    // Query 4: Fetch applier info
    db
      .select({
        username: users.username,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, cashDiscount.appliedById))
      .limit(1),
  ]);

  // Extract results from parallel queries
  const [assessmentInfo] = assessmentInfoResult;
  const [applier] = applierResult;

  // 2. Fetch school year cutoff date (depends on assessmentInfo.schoolYearId)
  let cutoffDate: Date | null = null;
  let isExpired = false;

  if (assessmentInfo) {
    const [schoolYearInfo] = await db
      .select({
        cashDiscountCutoffDate: schoolYears.cashDiscountCutoffDate,
      })
      .from(schoolYears)
      .where(eq(schoolYears.id, assessmentInfo.schoolYearId))
      .limit(1);

    cutoffDate = schoolYearInfo?.cashDiscountCutoffDate ?? null;

    // Check if discount is expired: past cutoff AND no payment made yet
    const hasPaid = Number(assessmentInfo.totalPaid) > 0;
    if (cutoffDate && !hasPaid) {
      const now = new Date();
      // Set cutoff to end of day for comparison
      const cutoffEndOfDay = new Date(cutoffDate);
      cutoffEndOfDay.setHours(23, 59, 59, 999);
      isExpired = now > cutoffEndOfDay;
    }
  }

  // 3. Process results from parallel queries
  const appliedByName = applier?.username ?? "Unknown";

  // Calculate correct tuition base for filtering related discounts
  const originalTuitionBase = Number(cashDiscount.baseAmount);
  const cashDiscountAmount = Number(cashDiscount.discountAmount);
  const correctTuitionBase = Math.max(0, originalTuitionBase - cashDiscountAmount);
  const EPSILON = 0.01;

  // Filter to only discounts that used the correct (discounted) tuition base
  const relatedDiscounts: RelatedTuitionDiscount[] = otherTuitionDiscounts
    .filter((d) => {
      const baseAmount = Number(d.baseAmount);
      return Math.abs(baseAmount - correctTuitionBase) < EPSILON;
    })
    .map((d) => ({
      discountTypeName: d.discountTypeName,
      baseAmount: Number(d.baseAmount),
      discountAmount: Number(d.discountAmount),
    }));

  // Format cascade adjustments
  const formattedCascadeAdjustments: AppliedCascadeAdjustment[] = cascadeAdjustments
    .filter((adj) => adj.adjustmentAmount !== null)
    .map((adj) => ({
      discountTypeName: adj.discountTypeName,
      originalAmount: Number(adj.originalAmount),
      adjustmentAmount: Number(adj.adjustmentAmount),
    }));

  const totalCascadeAdjustment = formattedCascadeAdjustments.reduce(
    (sum, adj) => sum + adj.adjustmentAmount,
    0
  );

  return {
    hasAppliedCashDiscount: true,
    discountDetails: {
      studentDiscountId: cashDiscount.id,
      discountAmount: Number(cashDiscount.discountAmount),
      appliedAt: cashDiscount.appliedAt,
      appliedByName,
      cascadeAdjustments: formattedCascadeAdjustments,
      totalCascadeAdjustment,
      relatedDiscounts,
      cutoffDate,
      isExpired,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// Cascade Fix Detection (for out-of-order discount application)
// ─────────────────────────────────────────────────────────────────

/**
 * Check if cascade fix is needed for an assessment.
 *
 * This detects the case where:
 * 1. Cash discount (FULL_PAYMENT_DISCOUNT) was applied first
 * 2. Sibling/scholarship discounts were applied later
 * 3. The later discounts used the ORIGINAL tuition base instead of
 *    the DISCOUNTED tuition base (which is incorrect)
 *
 * This can happen when:
 * - Cash discount is applied via approval workflow (not at payment time)
 * - Subsequently, sibling/scholarship discounts are added
 *
 * The fix involves creating positive adjustment items that "add back"
 * the over-discounted amounts to the assessment balance.
 *
 * @param assessmentId - Assessment to check
 * @returns CascadeFixNeeded if fix is required, null otherwise
 */
export async function checkCascadeFixNeeded(
  assessmentId: string
): Promise<CascadeFixNeeded | null> {
  // 1. Check for existing non-reversed FULL_PAYMENT_DISCOUNT
  const [cashDiscount] = await db
    .select({
      id: studentDiscounts.id,
      discountAmount: studentDiscounts.discountAmount,
      baseAmount: studentDiscounts.baseAmount, // The original tuition base used for cash discount
    })
    .from(studentDiscounts)
    .where(
      and(
        eq(studentDiscounts.assessmentId, assessmentId),
        eq(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE),
        isNull(studentDiscounts.reversedAt)
      )
    )
    .limit(1);

  // No cash discount = no fix needed
  if (!cashDiscount) {
    return null;
  }

  // 2. Find tuition_only discounts that were applied WITHOUT cascade adjustment
  //    These are discounts that were applied after the cash discount but
  //    did not have their base recalculated
  const potentiallyMisaligned = await db
    .select({
      id: studentDiscounts.id,
      discountTypeName: studentDiscounts.discountTypeName,
      baseAmount: studentDiscounts.baseAmount,
      discountValue: studentDiscounts.discountValue,
      discountAmount: studentDiscounts.discountAmount,
      calculationType: studentDiscounts.calculationType,
      assessmentItemId: studentDiscounts.assessmentItemId,
    })
    .from(studentDiscounts)
    .where(
      and(
        eq(studentDiscounts.assessmentId, assessmentId),
        eq(studentDiscounts.baseType, "tuition_only"),
        // Exclude the cash discount itself
        ne(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE),
        // Only non-reversed discounts
        isNull(studentDiscounts.reversedAt),
        // Key condition: no cascade adjustment was applied yet
        isNull(studentDiscounts.cascadeAdjustmentAmount)
      )
    );

  // No candidates = no fix needed
  if (potentiallyMisaligned.length === 0) {
    return null;
  }

  // 3. Determine the ORIGINAL tuition base and CORRECT (discounted) base
  //    The cash discount's baseAmount IS the original tuition
  const originalTuitionBase = Number(cashDiscount.baseAmount);
  const cashDiscountAmount = Number(cashDiscount.discountAmount);
  const correctTuitionBase = Math.max(0, originalTuitionBase - cashDiscountAmount);

  // Small tolerance for floating point comparisons
  const EPSILON = 0.01;

  // 4. Check each discount to see if it used the WRONG (original) base
  //    A discount needs cascade fix only if:
  //    - Its baseAmount matches the ORIGINAL tuition (was calculated on wrong base)
  //    - NOT if its baseAmount already matches the CORRECT (discounted) tuition
  const adjustments: CascadeFixAdjustment[] = [];

  for (const discount of potentiallyMisaligned) {
    const discountBaseAmount = Number(discount.baseAmount);
    const discountValue = Number(discount.discountValue);
    const originalAmount = Number(discount.discountAmount);

    // Check if this discount used the ORIGINAL (incorrect) tuition base
    // If the discount's base is close to the original tuition, it needs fixing
    // If the discount's base is close to the correct (discounted) tuition, it was already cascaded correctly
    const usedOriginalBase = Math.abs(discountBaseAmount - originalTuitionBase) < EPSILON;
    const usedCorrectBase = Math.abs(discountBaseAmount - correctTuitionBase) < EPSILON;

    // Skip if discount already used the correct (discounted) base
    if (usedCorrectBase) {
      continue;
    }

    // Only process if discount used the original (wrong) base
    if (!usedOriginalBase) {
      // The base doesn't match either expected value - could be a different scenario
      // Skip to be safe (don't apply incorrect adjustments)
      continue;
    }

    // This discount used the original tuition - it needs cascade adjustment
    // Recalculate what the discount SHOULD have been on the correct base
    let correctAmount: number;
    if (discount.calculationType === "percentage") {
      correctAmount = correctTuitionBase * (discountValue / 100);
    } else {
      // Fixed amount: capped at the base
      correctAmount = Math.min(discountValue, correctTuitionBase);
    }

    const adjustmentNeeded = originalAmount - correctAmount;

    // Only include meaningful adjustments (> 1 centavo)
    if (adjustmentNeeded > EPSILON) {
      adjustments.push({
        studentDiscountId: discount.id,
        discountTypeName: discount.discountTypeName,
        originalBase: discountBaseAmount,
        correctBase: correctTuitionBase,
        originalAmount,
        correctAmount,
        adjustmentNeeded,
        assessmentItemId: discount.assessmentItemId,
      });
    }
  }

  // No significant adjustments = no fix needed
  if (adjustments.length === 0) {
    return null;
  }

  // 4. Calculate total adjustment
  const totalAdjustment = adjustments.reduce(
    (sum, adj) => sum + adj.adjustmentNeeded,
    0
  );

  return {
    needsFix: true,
    cashDiscountId: cashDiscount.id,
    cashDiscountAmount,
    adjustments,
    totalAdjustment,
  };
}
