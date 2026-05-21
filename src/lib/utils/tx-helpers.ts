/**
 * Transaction helpers for typed row locking (SELECT ... FOR UPDATE).
 *
 * These utilities eliminate repeated raw SQL patterns scattered across action files
 * and ensure consistent snake_case → camelCase mapping for locked rows.
 */

import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal transaction interface - works with both `db.transaction(tx => ...)` and `db` itself.
 * Uses `unknown[]` to accommodate both postgres-js RowList and standard arrays.
 */
export type DbExecutor = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown[]>;
};

// ─── Row Types (camelCase, matching schema.ts) ────────────────────────────────

export interface LockedPayment {
  id: string;
  studentId: string;
  assessmentId: string | null;
  bookletId: string | null;
  orNumber: string | null;
  orStatus: string;
  amount: string;
  paymentMethod: string;
  referenceNumber: string | null;
  paymentDate: Date;
  status: string;
  kind: string;
  remarks: string | null;
  reversesPaymentId: string | null;
  reversedAt: Date | null;
  reversedBy: string | null;
  reversedByRequestId: string | null;
  voidedAt: Date | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface LockedAssessment {
  id: string;
  enrollmentId: string;
  studentId: string;
  schoolYearId: string;
  totalAmount: string;
  totalPaid: string;
  totalDiscounts: string;
  balance: string;
  hasDiscountsPending: boolean;
  billingStatus: string;
  remarks: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  transferredAt: Date | null;
  transferredBy: string | null;
  transferredToAssessmentId: string | null;
  transferRemarks: string | null;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface LockedReceiptBooklet {
  id: string;
  series: string;
  prefix: string;
  startNumber: number;
  endNumber: number;
  nextNumber: number;
  status: string;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface LockedVoidRequest {
  id: string;
  paymentId: string;
  requestReason: string;
  status: string;
  requestedBy: string;
  requestedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionRemarks: string | null;
  cancelledAt: Date | null;
  reversalPaymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LockedStudentDiscount {
  id: string;
  studentId: string;
  assessmentId: string;
  discountRequestId: string;
  discountTypeCode: string;
  discountTypeName: string;
  calculationType: string;
  baseType: string;
  baseAmount: string;
  discountValue: string;
  discountAmount: string;
  assessmentItemId: string | null;
  reversedAt: Date | null;
  reversedBy: string | null;
  reversalRemarks: string | null;
  reversalDiscountId: string | null;
  replacedByRequestId: string | null;
  appliedAt: Date;
  appliedBy: string;
  createdAt: Date;
}

export interface LockedDiscountRequest {
  id: string;
  studentId: string;
  enrollmentId: string;
  assessmentId: string | null;
  discountTypeId: string;
  requestReason: string | null;
  baseAmount: string | null;
  calculatedAmount: string | null;
  overrideValue: string | null;
  overrideReason: string | null;
  status: string;
  requestedBy: string;
  requestedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionRemarks: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  reversedAt: Date | null;
  reversedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LockedEnrollment {
  id: string;
  studentId: string;
  schoolYearId: string;
  gradeLevelId: string;
  sectionId: string | null;
  registrationId: string | null;
  studentType: string;
  intakeDocuments: unknown;
  status: string;
  enrolledAt: Date | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancelRemarks: string | null;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

// ─── Snake to Camel Conversion ────────────────────────────────────────────────

/**
 * Convert snake_case keys to camelCase.
 * Handles nested objects (single level only for now).
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function transformSnakeToCamel<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel(key)] = value;
  }
  return result as T;
}

// ─── Lock Functions ───────────────────────────────────────────────────────────

/**
 * Lock and fetch a single payment by ID.
 *
 * @example
 * const payment = await lockPayment(tx, paymentId);
 * if (!payment) throw new Error("Payment not found.");
 * if (payment.status !== "posted") throw new Error("...");
 */
export async function lockPayment(
  tx: DbExecutor,
  paymentId: string
): Promise<LockedPayment | null> {
  const rows = await tx.execute(
    sql`SELECT * FROM "payments" WHERE "id" = ${paymentId} FOR UPDATE`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return transformSnakeToCamel<LockedPayment>(rows[0] as Record<string, unknown>);
}

/**
 * Lock and fetch a single assessment by ID.
 */
export async function lockAssessment(
  tx: DbExecutor,
  assessmentId: string
): Promise<LockedAssessment | null> {
  const rows = await tx.execute(
    sql`SELECT * FROM "assessments" WHERE "id" = ${assessmentId} FOR UPDATE`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return transformSnakeToCamel<LockedAssessment>(rows[0] as Record<string, unknown>);
}

/**
 * Lock and fetch an assessment by enrollment ID.
 */
export async function lockAssessmentByEnrollment(
  tx: DbExecutor,
  enrollmentId: string
): Promise<LockedAssessment | null> {
  const rows = await tx.execute(
    sql`SELECT * FROM "assessments" WHERE "enrollment_id" = ${enrollmentId} FOR UPDATE`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return transformSnakeToCamel<LockedAssessment>(rows[0] as Record<string, unknown>);
}

/**
 * Lock and fetch a single receipt booklet by ID.
 * Optionally filter by status (e.g., 'active').
 */
export async function lockReceiptBooklet(
  tx: DbExecutor,
  bookletId: string,
  statusFilter?: string
): Promise<LockedReceiptBooklet | null> {
  const query = statusFilter
    ? sql`SELECT * FROM "receipt_booklets" WHERE "id" = ${bookletId} AND "status" = ${statusFilter} FOR UPDATE`
    : sql`SELECT * FROM "receipt_booklets" WHERE "id" = ${bookletId} FOR UPDATE`;

  const rows = await tx.execute(query);

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return transformSnakeToCamel<LockedReceiptBooklet>(rows[0] as Record<string, unknown>);
}

/**
 * Lock and fetch a single void request by ID.
 */
export async function lockVoidRequest(
  tx: DbExecutor,
  requestId: string
): Promise<LockedVoidRequest | null> {
  const rows = await tx.execute(
    sql`SELECT * FROM "void_requests" WHERE "id" = ${requestId} FOR UPDATE`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return transformSnakeToCamel<LockedVoidRequest>(rows[0] as Record<string, unknown>);
}

/**
 * Lock and fetch a single student discount by ID.
 */
export async function lockStudentDiscount(
  tx: DbExecutor,
  studentDiscountId: string
): Promise<LockedStudentDiscount | null> {
  const rows = await tx.execute(
    sql`SELECT * FROM "student_discounts" WHERE "id" = ${studentDiscountId} FOR UPDATE`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return transformSnakeToCamel<LockedStudentDiscount>(rows[0] as Record<string, unknown>);
}

/**
 * Lock and fetch a single discount request by ID.
 */
export async function lockDiscountRequest(
  tx: DbExecutor,
  requestId: string
): Promise<LockedDiscountRequest | null> {
  const rows = await tx.execute(
    sql`SELECT * FROM "discount_requests" WHERE "id" = ${requestId} FOR UPDATE`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return transformSnakeToCamel<LockedDiscountRequest>(rows[0] as Record<string, unknown>);
}

/**
 * Lock and fetch a single enrollment by ID.
 */
export async function lockEnrollment(
  tx: DbExecutor,
  enrollmentId: string
): Promise<LockedEnrollment | null> {
  const rows = await tx.execute(
    sql`SELECT * FROM "enrollments" WHERE "id" = ${enrollmentId} FOR UPDATE`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return transformSnakeToCamel<LockedEnrollment>(rows[0] as Record<string, unknown>);
}

// ─── Partial Lock Functions (specific columns only) ───────────────────────────

/**
 * Lock assessment and fetch only transfer status (for guard checks).
 * More efficient when you don't need full row data.
 */
export async function lockAssessmentTransferStatus(
  tx: DbExecutor,
  assessmentId: string
): Promise<{ transferredAt: Date | null } | null> {
  const rows = await tx.execute(
    sql`SELECT "transferred_at" FROM "assessments" WHERE "id" = ${assessmentId} FOR UPDATE`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0] as { transferred_at: Date | null };
  return { transferredAt: row.transferred_at };
}

/**
 * Lock student discount and fetch only reversal status (for guard checks).
 */
export async function lockStudentDiscountReversalStatus(
  tx: DbExecutor,
  studentDiscountId: string
): Promise<{ reversedAt: Date | null } | null> {
  const rows = await tx.execute(
    sql`SELECT "reversed_at" FROM "student_discounts" WHERE "id" = ${studentDiscountId} FOR UPDATE`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0] as { reversed_at: Date | null };
  return { reversedAt: row.reversed_at };
}
