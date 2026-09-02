import { db } from "@/lib/db";
import {
  payments,
  students,
  assessments,
  enrollments,
  gradeLevels,
  schoolYears,
  users,
  receiptBooklets,
  studentDiscounts,
} from "@/lib/db/schema";
import { eq, and, gte, lte, sql, asc, desc, isNull, inArray } from "drizzle-orm";
import { calculateOffset } from "@/lib/types/pagination";

// Re-export types and constants from types file for backward compatibility
export type {
  PaymentCollectionRow,
  PaymentMethodBreakdown,
  PaymentCollectionSummary,
  PaymentCollectionParams,
  PaymentCollectionResult,
  ProcessedByOption,
  BookletFilterOption,
} from "./payment-collection-report.types";

export {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "./payment-collection-report.types";

// Import types for internal use
import type {
  PaymentCollectionRow,
  PaymentCollectionSummary,
  PaymentCollectionParams,
  PaymentCollectionResult,
  ProcessedByOption,
  BookletFilterOption,
} from "./payment-collection-report.types";

// ─── Query Functions ─────────────────────────────────────────────────────────

/**
 * Get payment collection report with filtering and pagination.
 * Returns payments and reversals (excluding balance_forward) within the specified date range.
 * For reversals, the referenceNumber (e.g., "REV-CS 00007") is shown as the OR Number.
 * @param params.page - Page number (1-indexed), defaults to 1
 * @param params.pageSize - Number of items per page, defaults to 50, max 100
 */
export async function getPaymentCollectionReport(
  params: PaymentCollectionParams
): Promise<PaymentCollectionResult> {
  const {
    startDate,
    endDate,
    schoolYearId,
    paymentMethod,
    paymentStatus,
    usageMode,
    processedByUserId,
    bookletId,
  } = params;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = calculateOffset(page, pageSize);

  // Build WHERE conditions
  const conditions = buildWhereConditions({
    startDate,
    endDate,
    schoolYearId,
    paymentMethod,
    paymentStatus,
    usageMode,
    processedByUserId,
    bookletId,
  });

  // Alias for cashier user
  const cashier = users;

  const [results, countResult] = await Promise.all([
    db
      .select({
        id: payments.id,
        orNumber: payments.orNumber,
        collectionDate: payments.paymentDate,
        studentId: payments.studentId,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        studentRef: students.referenceNumber,
        isSpecialEducation: students.isSpecialEducation,
        hasEscDiscount: sql<boolean>`EXISTS(
          SELECT 1 FROM "discount_requests" dr
          INNER JOIN "discount_types" dt ON dr.discount_type_id = dt.id
          INNER JOIN "enrollments" e2 ON dr.enrollment_id = e2.id
          WHERE e2.student_id = "students".id
            AND dt.code LIKE 'ESC_%'
            AND dr.status = 'approved'
        )`.as("has_esc_discount"),
        gradeLevel: gradeLevels.name,
        schoolYear: schoolYears.label,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        referenceNumber: payments.referenceNumber,
        status: payments.status,
        kind: payments.kind,
        remarks: payments.remarks,
        processedBy: cashier.username,
        usageMode: receiptBooklets.usageMode,
      })
      .from(payments)
      .innerJoin(students, eq(payments.studentId, students.id))
      .innerJoin(assessments, eq(payments.assessmentId, assessments.id))
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
      .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
      .leftJoin(cashier, eq(payments.createdBy, cashier.id))
      .leftJoin(receiptBooklets, eq(payments.bookletId, receiptBooklets.id))
      .where(and(...conditions))
      .orderBy(asc(payments.paymentDate), asc(payments.orNumber))
      .limit(pageSize)
      .offset(offset),
    db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(payments)
      .innerJoin(students, eq(payments.studentId, students.id))
      .innerJoin(assessments, eq(payments.assessmentId, assessments.id))
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .leftJoin(receiptBooklets, eq(payments.bookletId, receiptBooklets.id))
      .where(and(...conditions))
      .then((r) => r[0]),
  ]);

  const rows = results.map((row) => ({
    id: row.id,
    // For reversals, use referenceNumber (e.g., "REV-CS 00007") as OR Number
    orNumber: row.kind === "reversal" ? (row.referenceNumber ?? "") : (row.orNumber ?? ""),
    collectionDate: row.collectionDate,
    studentId: row.studentId,
    studentName: `${row.studentLastName}, ${row.studentFirstName}`,
    studentRef: row.studentRef,
    isSpecialEducation: row.isSpecialEducation,
    hasEscDiscount: row.hasEscDiscount,
    gradeLevel: row.gradeLevel,
    schoolYear: row.schoolYear,
    amount: row.amount,
    paymentMethod: row.paymentMethod,
    referenceNumber: row.referenceNumber,
    status: row.status,
    kind: row.kind,
    remarks: row.remarks,
    processedBy: row.processedBy ?? "System",
    usageMode: row.usageMode,
  }));

  return {
    rows,
    totalCount: countResult?.count ?? 0,
  };
}

/**
 * Get summary statistics for payment collections within a date range.
 * Includes breakdown by payment method.
 */
export async function getPaymentCollectionSummary(params: {
  startDate: Date;
  endDate: Date;
  schoolYearId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  usageMode?: string;
  processedByUserId?: string;
  bookletId?: string;
}): Promise<PaymentCollectionSummary> {
  const {
    startDate,
    endDate,
    schoolYearId,
    paymentMethod,
    paymentStatus,
    usageMode,
    processedByUserId,
    bookletId,
  } = params;

  // Build WHERE conditions (same as report query)
  const conditions = buildWhereConditions({
    startDate,
    endDate,
    schoolYearId,
    paymentMethod,
    paymentStatus,
    usageMode,
    processedByUserId,
    bookletId,
  });

  // Main aggregate query
  const summaryResult = await db
    .select({
      totalCount: sql<number>`COUNT(*)::int`,
      totalAmount: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)::numeric`,
      cashTotal: sql<number>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'cash' THEN ${payments.amount}::numeric ELSE 0 END), 0)::numeric`,
      gcashTotal: sql<number>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'gcash' THEN ${payments.amount}::numeric ELSE 0 END), 0)::numeric`,
      bankTransferTotal: sql<number>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'bank_transfer' THEN ${payments.amount}::numeric ELSE 0 END), 0)::numeric`,
      checkTotal: sql<number>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'check' THEN ${payments.amount}::numeric ELSE 0 END), 0)::numeric`,
      otherTotal: sql<number>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} NOT IN ('cash', 'gcash', 'bank_transfer', 'check') THEN ${payments.amount}::numeric ELSE 0 END), 0)::numeric`,
    })
    .from(payments)
    .innerJoin(students, eq(payments.studentId, students.id))
    .innerJoin(assessments, eq(payments.assessmentId, assessments.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .leftJoin(receiptBooklets, eq(payments.bookletId, receiptBooklets.id))
    .where(and(...conditions));

  const summary = summaryResult[0] ?? {
    totalCount: 0,
    totalAmount: 0,
    cashTotal: 0,
    gcashTotal: 0,
    bankTransferTotal: 0,
    checkTotal: 0,
    otherTotal: 0,
  };

  return {
    totalCount: summary.totalCount,
    totalAmount: Number(summary.totalAmount),
    byMethod: {
      cash: Number(summary.cashTotal),
      gcash: Number(summary.gcashTotal),
      bank_transfer: Number(summary.bankTransferTotal),
      check: Number(summary.checkTotal),
      other: Number(summary.otherTotal),
    },
    periodStart: startDate,
    periodEnd: endDate,
  };
}

/**
 * Get all payment collection data for PDF export.
 * Includes payments and reversals (excluding balance_forward).
 * For reversals, the referenceNumber (e.g., "REV-CS 00007") is shown as the OR Number.
 * Maximum 5000 rows to prevent memory issues.
 */
export async function getAllPaymentCollectionData(params: {
  startDate: Date;
  endDate: Date;
  schoolYearId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  usageMode?: string;
  processedByUserId?: string;
  bookletId?: string;
}): Promise<PaymentCollectionRow[]> {
  const MAX_PDF_ROWS = 5000;

  const {
    startDate,
    endDate,
    schoolYearId,
    paymentMethod,
    paymentStatus,
    usageMode,
    processedByUserId,
    bookletId,
  } = params;

  const conditions = buildWhereConditions({
    startDate,
    endDate,
    schoolYearId,
    paymentMethod,
    paymentStatus,
    usageMode,
    processedByUserId,
    bookletId,
  });

  const cashier = users;

  const results = await db
    .select({
      id: payments.id,
      orNumber: payments.orNumber,
      collectionDate: payments.paymentDate,
      studentId: payments.studentId,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentRef: students.referenceNumber,
      isSpecialEducation: students.isSpecialEducation,
      hasEscDiscount: sql<boolean>`EXISTS(
        SELECT 1 FROM "discount_requests" dr
        INNER JOIN "discount_types" dt ON dr.discount_type_id = dt.id
        INNER JOIN "enrollments" e2 ON dr.enrollment_id = e2.id
        WHERE e2.student_id = "students".id
          AND dt.code LIKE 'ESC_%'
          AND dr.status = 'approved'
      )`.as("has_esc_discount"),
      gradeLevel: gradeLevels.name,
      schoolYear: schoolYears.label,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      referenceNumber: payments.referenceNumber,
      status: payments.status,
      kind: payments.kind,
      remarks: payments.remarks,
      processedBy: cashier.username,
      usageMode: receiptBooklets.usageMode,
    })
    .from(payments)
    .innerJoin(students, eq(payments.studentId, students.id))
    .innerJoin(assessments, eq(payments.assessmentId, assessments.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .leftJoin(cashier, eq(payments.createdBy, cashier.id))
    .leftJoin(receiptBooklets, eq(payments.bookletId, receiptBooklets.id))
    .where(and(...conditions))
    .orderBy(asc(payments.paymentDate), asc(payments.orNumber))
    .limit(MAX_PDF_ROWS);

  return results.map((row) => ({
    id: row.id,
    // For reversals, use referenceNumber (e.g., "REV-CS 00007") as OR Number
    orNumber: row.kind === "reversal" ? (row.referenceNumber ?? "") : (row.orNumber ?? ""),
    collectionDate: row.collectionDate,
    studentId: row.studentId,
    studentName: `${row.studentLastName}, ${row.studentFirstName}`,
    studentRef: row.studentRef,
    isSpecialEducation: row.isSpecialEducation,
    hasEscDiscount: row.hasEscDiscount,
    gradeLevel: row.gradeLevel,
    schoolYear: row.schoolYear,
    amount: row.amount,
    paymentMethod: row.paymentMethod,
    referenceNumber: row.referenceNumber,
    status: row.status,
    kind: row.kind,
    remarks: row.remarks,
    processedBy: row.processedBy ?? "System",
    usageMode: row.usageMode,
  }));
}

/**
 * Get all school years for the filter dropdown.
 */
export async function getSchoolYearsForPaymentReport(): Promise<
  Array<{ id: string; label: string }>
> {
  const results = await db
    .select({
      id: schoolYears.id,
      label: schoolYears.label,
    })
    .from(schoolYears)
    .orderBy(desc(schoolYears.startDate));

  return results;
}

/**
 * Get users who have processed payments (for admin dropdown filter).
 * Returns distinct users who have created payment records.
 */
export async function getUsersWhoProcessedPayments(): Promise<ProcessedByOption[]> {
  const results = await db
    .selectDistinct({
      id: users.id,
      username: users.username,
    })
    .from(payments)
    .innerJoin(users, eq(payments.createdBy, users.id))
    .where(inArray(payments.kind, ["payment", "reversal"]))
    .orderBy(asc(users.username));

  return results;
}

/**
 * Get booklets that have been used for payments within a date range (for filter dropdown).
 * Returns booklets with at least one payment record in the specified period.
 */
export async function getBookletsForPaymentFilter(params: {
  startDate: Date;
  endDate: Date;
}): Promise<BookletFilterOption[]> {
  const { startDate, endDate } = params;

  const results = await db
    .selectDistinct({
      id: receiptBooklets.id,
      series: receiptBooklets.series,
      startNumber: receiptBooklets.startNumber,
      endNumber: receiptBooklets.endNumber,
    })
    .from(payments)
    .innerJoin(receiptBooklets, eq(payments.bookletId, receiptBooklets.id))
    .where(
      and(
        inArray(payments.kind, ["payment", "reversal"]),
        gte(payments.paymentDate, startDate),
        lte(payments.paymentDate, endDate)
      )
    )
    .orderBy(asc(receiptBooklets.series), asc(receiptBooklets.startNumber));

  return results.map((row) => ({
    id: row.id,
    label: `${row.series} ${String(row.startNumber).padStart(5, "0")}-${String(row.endNumber).padStart(5, "0")}`,
  }));
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function buildWhereConditions(params: {
  startDate: Date;
  endDate: Date;
  schoolYearId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  usageMode?: string;
  processedByUserId?: string;
  bookletId?: string;
}) {
  const {
    startDate,
    endDate,
    schoolYearId,
    paymentMethod,
    paymentStatus,
    usageMode,
    processedByUserId,
    bookletId,
  } = params;

  // Base conditions: include payments and reversals (exclude BFX), within date range
  const conditions = [
    inArray(payments.kind, ["payment", "reversal"]),
    gte(payments.paymentDate, startDate),
    lte(payments.paymentDate, endDate),
    isNull(students.deletedAt),
  ];

  // Optional: filter by school year
  if (schoolYearId) {
    conditions.push(eq(assessments.schoolYearId, schoolYearId));
  }

  // Optional: filter by payment method
  if (paymentMethod) {
    conditions.push(eq(payments.paymentMethod, paymentMethod));
  }

  // Optional: filter by payment status - cast to enum type
  if (paymentStatus) {
    const validStatuses = [
      "pending_confirmation",
      "posted",
      "voided",
      "reversed",
      "reversal",
      "balance_forward",
    ] as const;
    type PaymentStatus = (typeof validStatuses)[number];
    if (validStatuses.includes(paymentStatus as PaymentStatus)) {
      conditions.push(eq(payments.status, paymentStatus as PaymentStatus));
    }
  }

  // Optional: filter by booklet usage mode (auto_only or manual_only)
  if (usageMode) {
    const validModes = ["auto_only", "manual_only"] as const;
    type UsageMode = (typeof validModes)[number];
    if (validModes.includes(usageMode as UsageMode)) {
      conditions.push(eq(receiptBooklets.usageMode, usageMode as UsageMode));
    }
  }

  // Optional: filter by user who processed the payment
  if (processedByUserId) {
    conditions.push(eq(payments.createdBy, processedByUserId));
  }

  // Optional: filter by receipt booklet
  if (bookletId) {
    conditions.push(eq(payments.bookletId, bookletId));
  }

  return conditions;
}
