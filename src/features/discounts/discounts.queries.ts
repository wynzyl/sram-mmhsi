import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  discountTypes,
  discountRequests,
  studentDiscounts,
  students,
  enrollments,
  schoolYears,
  gradeLevels,
  users,
  assessments,
  assessmentItems,
  feeItemTypes,
} from "@/lib/db/schema";
import { eq, desc, and, isNull, sql, inArray, or, ilike } from "drizzle-orm";
import { hasLivePayment, hasAnyPayment } from "@/lib/utils/payment-checks";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import {
  type PaginationParams,
  type PaginatedResult,
  calculatePagination,
  calculateOffset,
} from "@/lib/types/pagination";
import type {
  DiscountTypeView,
  DiscountRequestView,
  StudentDiscountView,
  DiscountRequestStatus,
} from "./discounts.schema";

// ─── Discount Types Queries ───────────────────────────────────────────────────

/**
 * Shared `DiscountTypeView` projection for discount-type queries.
 * Explicit column selection - excludes audit fields (updatedAt, createdBy,
 * updatedBy, deletedBy). Keep this aligned with `DiscountTypeView` as the DTO
 * evolves so every discount-type query stays consistent.
 */
const discountTypeViewColumns = {
  id: discountTypes.id,
  code: discountTypes.code,
  name: discountTypes.name,
  description: discountTypes.description,
  calculationType: discountTypes.calculationType,
  baseType: discountTypes.baseType,
  defaultValue: discountTypes.defaultValue,
  isActive: discountTypes.isActive,
  requiresDocumentation: discountTypes.requiresDocumentation,
  isStackable: discountTypes.isStackable,
  displayOrder: discountTypes.displayOrder,
  createdAt: discountTypes.createdAt,
} as const;

/**
 * Get all active discount types for selection.
 * Cached for 1 hour; invalidated via revalidateTag(CACHE_TAGS.DISCOUNT_TYPES)
 * when discount types are created/updated/deleted.
 */
export async function getActiveDiscountTypes(): Promise<DiscountTypeView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.DISCOUNT_TYPES);
  cacheLife("hours"); // 1 hour revalidate

  return await db
    .select(discountTypeViewColumns)
    .from(discountTypes)
    .where(and(eq(discountTypes.isActive, true), isNull(discountTypes.deletedAt)))
    .orderBy(discountTypes.displayOrder, discountTypes.name);
}

/**
 * Get all discount types (including inactive) for admin management.
 * Cached for 1 hour; invalidated via revalidateTag(CACHE_TAGS.DISCOUNT_TYPES)
 * when discount types are created/updated/deleted.
 */
export async function getAllDiscountTypes(): Promise<DiscountTypeView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.DISCOUNT_TYPES);
  cacheLife("hours"); // 1 hour revalidate

  return await db
    .select(discountTypeViewColumns)
    .from(discountTypes)
    .where(isNull(discountTypes.deletedAt))
    .orderBy(discountTypes.displayOrder, discountTypes.name);
}

/**
 * Get a single discount type by ID
 */
export async function getDiscountTypeById(
  id: string
): Promise<DiscountTypeView | null> {
  const [row] = await db
    .select(discountTypeViewColumns)
    .from(discountTypes)
    .where(and(eq(discountTypes.id, id), isNull(discountTypes.deletedAt)))
    .limit(1);

  return row ?? null;
}

// ─── Discount Requests Queries ────────────────────────────────────────────────

// Alias for user join
const requestedByUser = users;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future use in decided-by joins
const decidedByUser = users;

/**
 * Get pending discount requests for finance review queue
 */
export async function getPendingDiscountRequests(
  params: PaginationParams & {
    schoolYearId?: string;
    gradeLevelId?: string;
    searchQuery?: string;
  } = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<DiscountRequestView>> {
  const { page, pageSize, schoolYearId, gradeLevelId, searchQuery } = params;
  const offset = calculateOffset(page, pageSize);

  // Build where conditions
  const conditions = [eq(discountRequests.status, "pending")];

  if (schoolYearId) {
    conditions.push(eq(enrollments.schoolYearId, schoolYearId));
  }

  if (gradeLevelId) {
    conditions.push(eq(enrollments.gradeLevelId, gradeLevelId));
  }

  // Build search condition (reused in both queries)
  const searchCondition = searchQuery
    ? or(
        ilike(students.firstName, `%${searchQuery}%`),
        ilike(students.lastName, `%${searchQuery}%`),
        ilike(students.referenceNumber, `%${searchQuery}%`)
      )
    : undefined;

  // Parallelize count and data queries
  const [countResult, rows] = await Promise.all([
    // Count query
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(discountRequests)
      .innerJoin(enrollments, eq(discountRequests.enrollmentId, enrollments.id))
      .innerJoin(students, eq(discountRequests.studentId, students.id))
      .where(and(...conditions, searchCondition)),

    // Data query
    db
      .select({
        id: discountRequests.id,
        studentId: discountRequests.studentId,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        studentRef: students.referenceNumber,
        enrollmentId: discountRequests.enrollmentId,
        gradeLevelName: gradeLevels.name,
        schoolYearLabel: schoolYears.label,
        discountTypeId: discountRequests.discountTypeId,
        discountTypeCode: discountTypes.code,
        discountTypeName: discountTypes.name,
        calculationType: discountTypes.calculationType,
        baseType: discountTypes.baseType,
        defaultValue: discountTypes.defaultValue,
        requestReason: discountRequests.requestReason,
        status: discountRequests.status,
        requestedBy: discountRequests.requestedBy,
        requestedByFirstName: requestedByUser.username,
        requestedAt: discountRequests.requestedAt,
        decidedBy: discountRequests.decidedBy,
        decidedAt: discountRequests.decidedAt,
        decisionRemarks: discountRequests.decisionRemarks,
        overrideValue: discountRequests.overrideValue,
        overrideReason: discountRequests.overrideReason,
      })
      .from(discountRequests)
      .innerJoin(students, eq(discountRequests.studentId, students.id))
      .innerJoin(enrollments, eq(discountRequests.enrollmentId, enrollments.id))
      .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
      .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
      .innerJoin(discountTypes, eq(discountRequests.discountTypeId, discountTypes.id))
      .innerJoin(requestedByUser, eq(discountRequests.requestedBy, requestedByUser.id))
      .where(and(...conditions, searchCondition))
      .orderBy(desc(discountRequests.requestedAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  const totalRecords = Number(countResult[0]?.count ?? 0);

  const data: DiscountRequestView[] = rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: `${r.studentLastName}, ${r.studentFirstName}`,
    studentRef: r.studentRef,
    enrollmentId: r.enrollmentId,
    gradeLevelName: r.gradeLevelName,
    schoolYearLabel: r.schoolYearLabel,
    discountTypeId: r.discountTypeId,
    discountTypeCode: r.discountTypeCode,
    discountTypeName: r.discountTypeName,
    calculationType: r.calculationType,
    baseType: r.baseType,
    defaultValue: r.defaultValue,
    requestReason: r.requestReason,
    status: r.status,
    requestedBy: r.requestedBy,
    requestedByName: r.requestedByFirstName,
    requestedAt: r.requestedAt,
    decidedBy: r.decidedBy,
    decidedByName: null, // Would need another join for decider name
    decidedAt: r.decidedAt,
    decisionRemarks: r.decisionRemarks,
    overrideValue: r.overrideValue,
    overrideReason: r.overrideReason,
    assessmentId: null, // Pending requests never have an assessment link.
    enrollmentHasAssessment: false,
  }));

  return {
    data,
    pagination: calculatePagination(page, pageSize, totalRecords),
  };
}

/**
 * Get discount requests by enrollment (for enrollment detail view)
 */
export async function getDiscountRequestsByEnrollment(
  enrollmentId: string
): Promise<DiscountRequestView[]> {
  const rows = await db
    .select({
      id: discountRequests.id,
      studentId: discountRequests.studentId,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentRef: students.referenceNumber,
      enrollmentId: discountRequests.enrollmentId,
      gradeLevelName: gradeLevels.name,
      schoolYearLabel: schoolYears.label,
      discountTypeId: discountRequests.discountTypeId,
      discountTypeCode: discountTypes.code,
      discountTypeName: discountTypes.name,
      calculationType: discountTypes.calculationType,
      baseType: discountTypes.baseType,
      defaultValue: discountTypes.defaultValue,
      requestReason: discountRequests.requestReason,
      status: discountRequests.status,
      requestedBy: discountRequests.requestedBy,
      requestedByName: users.username,
      requestedAt: discountRequests.requestedAt,
      decidedBy: discountRequests.decidedBy,
      decidedAt: discountRequests.decidedAt,
      decisionRemarks: discountRequests.decisionRemarks,
      overrideValue: discountRequests.overrideValue,
      overrideReason: discountRequests.overrideReason,
    })
    .from(discountRequests)
    .innerJoin(students, eq(discountRequests.studentId, students.id))
    .innerJoin(enrollments, eq(discountRequests.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(discountTypes, eq(discountRequests.discountTypeId, discountTypes.id))
    .innerJoin(users, eq(discountRequests.requestedBy, users.id))
    .where(
      and(
        eq(discountRequests.enrollmentId, enrollmentId),
        // Exclude discounts already applied to any assessment (active or cancelled)
        // Only show pending-to-apply discounts (assessmentId IS NULL)
        // This aligns with applyApprovedDiscountsToAssessment() logic
        isNull(discountRequests.assessmentId)
      )
    )
    .orderBy(desc(discountRequests.requestedAt));

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: `${r.studentLastName}, ${r.studentFirstName}`,
    studentRef: r.studentRef,
    enrollmentId: r.enrollmentId,
    gradeLevelName: r.gradeLevelName,
    schoolYearLabel: r.schoolYearLabel,
    discountTypeId: r.discountTypeId,
    discountTypeCode: r.discountTypeCode,
    discountTypeName: r.discountTypeName,
    calculationType: r.calculationType,
    baseType: r.baseType,
    defaultValue: r.defaultValue,
    requestReason: r.requestReason,
    status: r.status,
    requestedBy: r.requestedBy,
    requestedByName: r.requestedByName,
    requestedAt: r.requestedAt,
    decidedBy: r.decidedBy,
    decidedByName: null,
    decidedAt: r.decidedAt,
    decisionRemarks: r.decisionRemarks,
    overrideValue: r.overrideValue,
    overrideReason: r.overrideReason,
    assessmentId: null,
    enrollmentHasAssessment: false,
  }));
}

// ─── Discount Request Gate ────────────────────────────────────────────────────

export type DiscountRequestGate =
  | { allowed: true }
  | {
      allowed: false;
      reason: string;
      code: "PAYMENT_POSTED" | "DISCOUNT_REVERSED";
    };

/**
 * Determines whether a new discount request can be created for the given
 * enrollment. Single source of truth used by both
 * `createDiscountRequestAction` (write-time enforcement) and the enrollment
 * detail page (UI gating).
 *
 * Rules:
 *   1. No active assessment yet (cancelled assessments don't count) → allowed.
 *      (Pre-assessment path is governed by the caller's
 *      enrollment.status === 'pending' check.)
 *   2. Non-voided payment exists on the assessment → blocked (PAYMENT_POSTED).
 *      Void the payment before requesting a replacement.
 *   3. A prior discount_requests row has status='reversed' AND any payments
 *      row exists on the assessment (voided or not) → blocked
 *      (DISCOUNT_REVERSED). A reversal alone (no payment activity) is treated
 *      as an admin correction and stays open.
 *   4. Otherwise → allowed.
 */
export async function getDiscountRequestGate(
  enrollmentId: string
): Promise<DiscountRequestGate> {
  // Only consider non-cancelled assessments
  const [assessment] = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(
      and(
        eq(assessments.enrollmentId, enrollmentId),
        isNull(assessments.cancelledAt)
      )
    )
    .limit(1);

  if (!assessment) {
    return { allowed: true };
  }

  // Check for live payments (pending_confirmation or posted) and any payment history
  const [hasLive, hasAny, reversedRequestRow] = await Promise.all([
    hasLivePayment(assessment.id),
    hasAnyPayment(assessment.id),
    db
      .select({ id: discountRequests.id })
      .from(discountRequests)
      .where(
        and(
          eq(discountRequests.enrollmentId, enrollmentId),
          eq(discountRequests.status, "reversed")
        )
      )
      .limit(1),
  ]);

  if (hasLive) {
    return {
      allowed: false,
      code: "PAYMENT_POSTED",
      reason:
        "Cannot request a new discount: a live payment exists on this assessment. Void the payment first.",
    };
  }

  if (reversedRequestRow.length > 0 && hasAny) {
    return {
      allowed: false,
      code: "DISCOUNT_REVERSED",
      reason:
        "Cannot request a new discount: this assessment has a previously reversed discount and recorded payment activity. Discount changes are locked once payments have been posted against the assessment.",
    };
  }

  return { allowed: true };
}

/**
 * Check if enrollment has pending discount requests (for payment blocking)
 */
export async function hasPendingDiscountRequests(
  enrollmentId: string
): Promise<boolean> {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(discountRequests)
    .where(
      and(
        eq(discountRequests.enrollmentId, enrollmentId),
        eq(discountRequests.status, "pending")
      )
    );

  return Number(result?.count ?? 0) > 0;
}

/**
 * Get approved discount requests for an enrollment (for assessment creation)
 */
export async function getApprovedDiscountRequestsForEnrollment(
  enrollmentId: string
): Promise<
  Array<{
    id: string;
    discountTypeId: string;
    overrideValue: string | null;
    discountType: {
      code: string;
      name: string;
      calculationType: "fixed_amount" | "percentage";
      baseType: "tuition_only" | "full_assessment";
      defaultValue: string;
    };
  }>
> {
  const rows = await db
    .select({
      id: discountRequests.id,
      discountTypeId: discountRequests.discountTypeId,
      overrideValue: discountRequests.overrideValue,
      discountTypeCode: discountTypes.code,
      discountTypeName: discountTypes.name,
      calculationType: discountTypes.calculationType,
      baseType: discountTypes.baseType,
      defaultValue: discountTypes.defaultValue,
    })
    .from(discountRequests)
    .innerJoin(discountTypes, eq(discountRequests.discountTypeId, discountTypes.id))
    .where(
      and(
        eq(discountRequests.enrollmentId, enrollmentId),
        eq(discountRequests.status, "approved"),
        isNull(discountRequests.assessmentId) // Not yet applied to an assessment
      )
    );

  return rows.map((r) => ({
    id: r.id,
    discountTypeId: r.discountTypeId,
    overrideValue: r.overrideValue,
    discountType: {
      code: r.discountTypeCode,
      name: r.discountTypeName,
      calculationType: r.calculationType,
      baseType: r.baseType,
      defaultValue: r.defaultValue,
    },
  }));
}

// ─── Student Discounts Queries ────────────────────────────────────────────────

/**
 * Get applied discounts for an assessment
 */
export async function getStudentDiscountsByAssessment(
  assessmentId: string
): Promise<StudentDiscountView[]> {
  const rows = await db
    .select({
      id: studentDiscounts.id,
      studentId: studentDiscounts.studentId,
      assessmentId: studentDiscounts.assessmentId,
      enrollmentId: assessments.enrollmentId,
      discountRequestId: studentDiscounts.discountRequestId,
      discountTypeCode: studentDiscounts.discountTypeCode,
      discountTypeName: studentDiscounts.discountTypeName,
      calculationType: studentDiscounts.calculationType,
      baseType: studentDiscounts.baseType,
      baseAmount: studentDiscounts.baseAmount,
      discountValue: studentDiscounts.discountValue,
      discountAmount: studentDiscounts.discountAmount,
      appliedAt: studentDiscounts.appliedAt,
      appliedByUsername: users.username,
      reversedAt: studentDiscounts.reversedAt,
      reversalRemarks: studentDiscounts.reversalRemarks,
      replacedByRequestId: studentDiscounts.replacedByRequestId,
    })
    .from(studentDiscounts)
    .innerJoin(users, eq(studentDiscounts.appliedBy, users.id))
    .innerJoin(assessments, eq(studentDiscounts.assessmentId, assessments.id))
    .where(eq(studentDiscounts.assessmentId, assessmentId))
    .orderBy(studentDiscounts.appliedAt);

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    assessmentId: r.assessmentId,
    enrollmentId: r.enrollmentId,
    discountRequestId: r.discountRequestId,
    discountTypeCode: r.discountTypeCode,
    discountTypeName: r.discountTypeName,
    calculationType: r.calculationType,
    baseType: r.baseType,
    baseAmount: r.baseAmount,
    discountValue: r.discountValue,
    discountAmount: r.discountAmount,
    appliedAt: r.appliedAt,
    appliedByName: r.appliedByUsername,
    reversedAt: r.reversedAt,
    reversedByName: null, // Would need another join
    reversalRemarks: r.reversalRemarks,
    hasReplacement: r.replacedByRequestId !== null,
  }));
}

/**
 * Get all discount requests for a student across all enrollments.
 * Shows pending, approved, and applied discounts (excludes rejected/cancelled).
 */
export async function getDiscountRequestsByStudent(
  studentId: string
): Promise<DiscountRequestView[]> {
  const rows = await db
    .select({
      id: discountRequests.id,
      studentId: discountRequests.studentId,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentRef: students.referenceNumber,
      enrollmentId: discountRequests.enrollmentId,
      gradeLevelName: gradeLevels.name,
      schoolYearLabel: schoolYears.label,
      discountTypeId: discountRequests.discountTypeId,
      discountTypeCode: discountTypes.code,
      discountTypeName: discountTypes.name,
      calculationType: discountTypes.calculationType,
      baseType: discountTypes.baseType,
      defaultValue: discountTypes.defaultValue,
      requestReason: discountRequests.requestReason,
      status: discountRequests.status,
      requestedBy: discountRequests.requestedBy,
      requestedByName: users.username,
      requestedAt: discountRequests.requestedAt,
      decidedBy: discountRequests.decidedBy,
      decidedAt: discountRequests.decidedAt,
      decisionRemarks: discountRequests.decisionRemarks,
      overrideValue: discountRequests.overrideValue,
      overrideReason: discountRequests.overrideReason,
      // Assessment info (null if not yet applied)
      assessmentId: discountRequests.assessmentId,
      assessmentBillingStatus: assessments.billingStatus,
      // Applied discount amount (null if not yet applied)
      appliedDiscountAmount: studentDiscounts.discountAmount,
    })
    .from(discountRequests)
    .innerJoin(students, eq(discountRequests.studentId, students.id))
    .innerJoin(enrollments, eq(discountRequests.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(discountTypes, eq(discountRequests.discountTypeId, discountTypes.id))
    .innerJoin(users, eq(discountRequests.requestedBy, users.id))
    .leftJoin(assessments, eq(discountRequests.assessmentId, assessments.id))
    .leftJoin(
      studentDiscounts,
      and(
        eq(discountRequests.id, studentDiscounts.discountRequestId),
        isNull(studentDiscounts.reversedAt)
      )
    )
    .where(
      and(
        eq(discountRequests.studentId, studentId),
        // Show all non-rejected/non-cancelled discounts:
        // - pending: waiting for approval
        // - approved: ready to apply (or already applied)
        // Excludes: rejected, cancelled, reversed
        inArray(discountRequests.status, ["pending", "approved"])
      )
    )
    .orderBy(desc(discountRequests.requestedAt));

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: `${r.studentLastName}, ${r.studentFirstName}`,
    studentRef: r.studentRef,
    enrollmentId: r.enrollmentId,
    gradeLevelName: r.gradeLevelName,
    schoolYearLabel: r.schoolYearLabel,
    discountTypeId: r.discountTypeId,
    discountTypeCode: r.discountTypeCode,
    discountTypeName: r.discountTypeName,
    calculationType: r.calculationType,
    baseType: r.baseType,
    defaultValue: r.defaultValue,
    requestReason: r.requestReason,
    status: r.status,
    requestedBy: r.requestedBy,
    requestedByName: r.requestedByName,
    requestedAt: r.requestedAt,
    decidedBy: r.decidedBy,
    decidedByName: null,
    decidedAt: r.decidedAt,
    decisionRemarks: r.decisionRemarks,
    overrideValue: r.overrideValue,
    overrideReason: r.overrideReason,
    assessmentId: r.assessmentId,
    enrollmentHasAssessment: r.assessmentId !== null,
    // Additional fields for display (extend type if needed)
    appliedDiscountAmount: r.appliedDiscountAmount,
    assessmentBillingStatus: r.assessmentBillingStatus,
  }));
}

/**
 * Get assessment items with fee type codes (for discount calculation)
 */
export async function getAssessmentItemsWithFeeTypes(
  assessmentId: string
): Promise<
  Array<{
    id: string;
    amount: string;
    isDiscount: boolean;
    feeItemTypeCode: string | null;
  }>
> {
  const rows = await db
    .select({
      id: assessmentItems.id,
      amount: assessmentItems.amount,
      isDiscount: assessmentItems.isDiscount,
      feeItemTypeCode: feeItemTypes.code,
    })
    .from(assessmentItems)
    .leftJoin(feeItemTypes, eq(assessmentItems.feeItemTypeId, feeItemTypes.id))
    .where(eq(assessmentItems.assessmentId, assessmentId));

  return rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    isDiscount: r.isDiscount,
    feeItemTypeCode: r.feeItemTypeCode,
  }));
}

// ─── Dashboard / Summary Queries ──────────────────────────────────────────────

/**
 * Get discount request counts by status, optionally filtered by school year
 */
export async function getDiscountRequestCounts(schoolYearId?: string): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}> {
  const baseQuery = schoolYearId
    ? db
        .select({
          status: discountRequests.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(discountRequests)
        .innerJoin(enrollments, eq(discountRequests.enrollmentId, enrollments.id))
        .where(eq(enrollments.schoolYearId, schoolYearId))
        .groupBy(discountRequests.status)
    : db
        .select({
          status: discountRequests.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(discountRequests)
        .groupBy(discountRequests.status);

  const rows = await baseQuery;

  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  };

  for (const row of rows) {
    const count = Number(row.count);
    counts.total += count;
    if (row.status === "pending") counts.pending = count;
    if (row.status === "approved") counts.approved = count;
    if (row.status === "rejected") counts.rejected = count;
  }

  return counts;
}

/**
 * Get discount requests history (approved + rejected) for reporting
 */
export async function getDiscountRequestsHistory(
  params: PaginationParams & {
    status?: DiscountRequestStatus;
    schoolYearId?: string;
    fromDate?: Date;
    toDate?: Date;
  } = { page: 1, pageSize: 50 }
): Promise<PaginatedResult<DiscountRequestView>> {
  const { page, pageSize, status, schoolYearId, fromDate, toDate } = params;
  const offset = calculateOffset(page, pageSize);

  // Build where conditions
  const conditions: ReturnType<typeof and>[] = [];

  if (status) {
    conditions.push(eq(discountRequests.status, status));
  } else {
    // Default: show approved and rejected (history)
    conditions.push(
      or(
        eq(discountRequests.status, "approved"),
        eq(discountRequests.status, "rejected")
      )
    );
  }

  if (schoolYearId) {
    conditions.push(eq(enrollments.schoolYearId, schoolYearId));
  }

  if (fromDate) {
    conditions.push(sql`${discountRequests.decidedAt} >= ${fromDate}`);
  }

  if (toDate) {
    conditions.push(sql`${discountRequests.decidedAt} <= ${toDate}`);
  }

  // Count query
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(discountRequests)
    .innerJoin(enrollments, eq(discountRequests.enrollmentId, enrollments.id))
    .where(and(...conditions));

  const totalRecords = Number(countResult?.count ?? 0);

  // Data query
  const rows = await db
    .select({
      id: discountRequests.id,
      studentId: discountRequests.studentId,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentRef: students.referenceNumber,
      enrollmentId: discountRequests.enrollmentId,
      gradeLevelName: gradeLevels.name,
      schoolYearLabel: schoolYears.label,
      discountTypeId: discountRequests.discountTypeId,
      discountTypeCode: discountTypes.code,
      discountTypeName: discountTypes.name,
      calculationType: discountTypes.calculationType,
      baseType: discountTypes.baseType,
      defaultValue: discountTypes.defaultValue,
      requestReason: discountRequests.requestReason,
      status: discountRequests.status,
      requestedBy: discountRequests.requestedBy,
      requestedByName: users.username,
      requestedAt: discountRequests.requestedAt,
      decidedBy: discountRequests.decidedBy,
      decidedAt: discountRequests.decidedAt,
      decisionRemarks: discountRequests.decisionRemarks,
      overrideValue: discountRequests.overrideValue,
      overrideReason: discountRequests.overrideReason,
      // Applied discount amount (from studentDiscounts if applied)
      appliedDiscountAmount: studentDiscounts.discountAmount,
      // For canCancel calculation
      assessmentId: discountRequests.assessmentId,
      enrollmentStatus: enrollments.status,
      // Check if an active (non-cancelled) assessment exists for the enrollment
      hasActiveAssessment: sql<boolean>`EXISTS (
        SELECT 1 FROM assessments a
        WHERE a.enrollment_id = ${enrollments.id}
        AND a.cancelled_at IS NULL
      )`,
    })
    .from(discountRequests)
    .innerJoin(students, eq(discountRequests.studentId, students.id))
    .innerJoin(enrollments, eq(discountRequests.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(discountTypes, eq(discountRequests.discountTypeId, discountTypes.id))
    .innerJoin(users, eq(discountRequests.requestedBy, users.id))
    .leftJoin(
      studentDiscounts,
      and(
        eq(discountRequests.id, studentDiscounts.discountRequestId),
        isNull(studentDiscounts.reversedAt)
      )
    )
    .where(and(...conditions))
    .orderBy(desc(discountRequests.decidedAt))
    .limit(pageSize)
    .offset(offset);

  const data: DiscountRequestView[] = rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: `${r.studentLastName}, ${r.studentFirstName}`,
    studentRef: r.studentRef,
    enrollmentId: r.enrollmentId,
    gradeLevelName: r.gradeLevelName,
    schoolYearLabel: r.schoolYearLabel,
    discountTypeId: r.discountTypeId,
    discountTypeCode: r.discountTypeCode,
    discountTypeName: r.discountTypeName,
    calculationType: r.calculationType,
    baseType: r.baseType,
    defaultValue: r.defaultValue,
    requestReason: r.requestReason,
    status: r.status,
    requestedBy: r.requestedBy,
    requestedByName: r.requestedByName,
    requestedAt: r.requestedAt,
    decidedBy: r.decidedBy,
    decidedByName: null,
    decidedAt: r.decidedAt,
    decisionRemarks: r.decisionRemarks,
    overrideValue: r.overrideValue,
    overrideReason: r.overrideReason,
    assessmentId: r.assessmentId,
    enrollmentHasAssessment: r.hasActiveAssessment,
    appliedDiscountAmount: r.appliedDiscountAmount,
    // canCancel: approved, not applied to assessment, enrollment still pending (no assessment)
    canCancel:
      r.status === "approved" &&
      r.assessmentId === null &&
      r.enrollmentStatus === "pending" &&
      !r.hasActiveAssessment,
  }));

  return {
    data,
    pagination: calculatePagination(page, pageSize, totalRecords),
  };
}

/**
 * Get approved discount requests that have not been applied yet AND whose
 * parent enrollment already has a finalized assessment.
 *
 * This is the population that surfaces the "Apply to Assessment" action in
 * the finance UI — typically used after a Void OR + Reverse Discount cycle
 * where a replacement request was approved but never re-attached.
 */
export async function getApprovedUnappliedDiscountRequests(): Promise<
  DiscountRequestView[]
> {
  const rows = await db
    .select({
      id: discountRequests.id,
      studentId: discountRequests.studentId,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentRef: students.referenceNumber,
      enrollmentId: discountRequests.enrollmentId,
      gradeLevelName: gradeLevels.name,
      schoolYearLabel: schoolYears.label,
      discountTypeId: discountRequests.discountTypeId,
      discountTypeCode: discountTypes.code,
      discountTypeName: discountTypes.name,
      calculationType: discountTypes.calculationType,
      baseType: discountTypes.baseType,
      defaultValue: discountTypes.defaultValue,
      requestReason: discountRequests.requestReason,
      status: discountRequests.status,
      requestedBy: discountRequests.requestedBy,
      requestedByName: users.username,
      requestedAt: discountRequests.requestedAt,
      decidedBy: discountRequests.decidedBy,
      decidedAt: discountRequests.decidedAt,
      decisionRemarks: discountRequests.decisionRemarks,
      overrideValue: discountRequests.overrideValue,
      overrideReason: discountRequests.overrideReason,
      parentAssessmentId: assessments.id,
    })
    .from(discountRequests)
    .innerJoin(students, eq(discountRequests.studentId, students.id))
    .innerJoin(enrollments, eq(discountRequests.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(discountTypes, eq(discountRequests.discountTypeId, discountTypes.id))
    .innerJoin(users, eq(discountRequests.requestedBy, users.id))
    .innerJoin(assessments, eq(assessments.enrollmentId, enrollments.id))
    .where(
      and(
        eq(discountRequests.status, "approved"),
        isNull(discountRequests.assessmentId),
        isNull(assessments.transferredAt),
        isNull(assessments.cancelledAt)
      )
    )
    .orderBy(desc(discountRequests.decidedAt));

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: `${r.studentLastName}, ${r.studentFirstName}`,
    studentRef: r.studentRef,
    enrollmentId: r.enrollmentId,
    gradeLevelName: r.gradeLevelName,
    schoolYearLabel: r.schoolYearLabel,
    discountTypeId: r.discountTypeId,
    discountTypeCode: r.discountTypeCode,
    discountTypeName: r.discountTypeName,
    calculationType: r.calculationType,
    baseType: r.baseType,
    defaultValue: r.defaultValue,
    requestReason: r.requestReason,
    status: r.status,
    requestedBy: r.requestedBy,
    requestedByName: r.requestedByName,
    requestedAt: r.requestedAt,
    decidedBy: r.decidedBy,
    decidedByName: null,
    decidedAt: r.decidedAt,
    decisionRemarks: r.decisionRemarks,
    overrideValue: r.overrideValue,
    overrideReason: r.overrideReason,
    assessmentId: null, // null = unapplied; parent assessment exists separately.
    enrollmentHasAssessment: true,
  }));
}
