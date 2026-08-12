/**
 * Reusable query helpers for discount operations.
 *
 * These helpers extract commonly repeated query patterns used across
 * discount and payment operations, ensuring consistency and reducing
 * code duplication.
 */

import { db } from "@/lib/db";
import {
  studentDiscounts,
  assessmentItems,
  feeItemTypes,
} from "@/lib/db/schema";
import { eq, and, isNull, ne } from "drizzle-orm";
import { FULL_PAYMENT_DISCOUNT_CODE } from "@/lib/constants/discount-codes";
import type { StudentDiscountForCascade } from "./utils/cascade-calculations";
import type { CalculationAssessmentItem } from "./utils/discount-calculations";

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Database executor type that supports select queries.
 * Compatible with both direct db access and transaction contexts.
 */
type QueryExecutor = {
  select: typeof db.select;
};

/**
 * Raw student discount row from database query.
 * This is the shape returned by the database before type conversion.
 */
interface RawStudentDiscountRow {
  id: string;
  studentId: string;
  assessmentId: string;
  discountTypeCode: string;
  discountTypeName: string;
  calculationType: string;
  baseType: string;
  baseAmount: string;
  discountValue: string;
  discountAmount: string;
  assessmentItemId: string | null;
  cascadeAdjustmentAmount: string | null;
}

/**
 * Raw assessment item row from database query.
 */
interface RawAssessmentItemRow {
  id: string;
  amount: string;
  isDiscount: boolean;
  feeItemTypeCode: string | null;
}

// ─── Query Helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch tuition-only discounts that are eligible for cascade adjustment.
 *
 * This query is used when applying a cash discount to identify existing
 * scholarships that need recalculation based on the discounted tuition.
 *
 * Filters:
 * - Only tuition_only base type discounts (scholarships affecting tuition)
 * - Not reversed (still active)
 * - Excludes cash discount itself (FULL_PAYMENT_DISCOUNT_CODE)
 *
 * @param executor - Database executor (db or transaction)
 * @param assessmentId - Assessment to fetch discounts for
 * @returns Array of student discounts ready for cascade calculation
 */
export async function getTuitionOnlyDiscountsForCascade(
  executor: QueryExecutor,
  assessmentId: string
): Promise<StudentDiscountForCascade[]> {
  const rows: RawStudentDiscountRow[] = await executor
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
    );

  // Convert to properly typed cascade format
  return rows.map((d) => ({
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
}

/**
 * Fetch assessment items with fee type codes for discount base calculation.
 *
 * This query is used when calculating discount bases or cascade adjustments.
 * The fee type code is needed to identify tuition items for tuition_only
 * discount base calculations.
 *
 * @param executor - Database executor (db or transaction)
 * @param assessmentId - Assessment to fetch items for
 * @returns Array of assessment items with fee type codes
 */
export async function getAssessmentItemsForDiscountCalc(
  executor: QueryExecutor,
  assessmentId: string
): Promise<CalculationAssessmentItem[]> {
  const rows: RawAssessmentItemRow[] = await executor
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
