import { db } from "@/lib/db";
import {
  payments,
  students,
  assessments,
  enrollments,
  gradeLevels,
  schoolYears,
  users,
} from "@/lib/db/schema";
import { eq, and, gte, lte, sql, asc, desc, isNull } from "drizzle-orm";

// Re-export types and constants from types file for backward compatibility
export type {
  PaymentCollectionRow,
  PaymentMethodBreakdown,
  PaymentCollectionSummary,
  PaymentCollectionParams,
  PaymentCollectionResult,
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
} from "./payment-collection-report.types";

// ─── Query Functions ─────────────────────────────────────────────────────────

/**
 * Get payment collection report with filtering and pagination.
 * Returns payments (excluding balance_forward and reversal kinds by default) within the specified date range.
 * @param params.page - Page number (1-indexed), defaults to 1
 * @param params.pageSize - Number of items per page, defaults to 50, max 100
 */
export async function getPaymentCollectionReport(
  params: PaymentCollectionParams
): Promise<PaymentCollectionResult> {
  const { startDate, endDate, schoolYearId, paymentMethod, paymentStatus } =
    params;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  // Build WHERE conditions
  const conditions = buildWhereConditions({
    startDate,
    endDate,
    schoolYearId,
    paymentMethod,
    paymentStatus,
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
        gradeLevel: gradeLevels.name,
        schoolYear: schoolYears.label,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        referenceNumber: payments.referenceNumber,
        status: payments.status,
        kind: payments.kind,
        remarks: payments.remarks,
        processedBy: cashier.username,
      })
      .from(payments)
      .innerJoin(students, eq(payments.studentId, students.id))
      .innerJoin(assessments, eq(payments.assessmentId, assessments.id))
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
      .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
      .leftJoin(cashier, eq(payments.createdBy, cashier.id))
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
      .where(and(...conditions))
      .then((r) => r[0]),
  ]);

  const rows = results.map((row) => ({
    id: row.id,
    orNumber: row.orNumber ?? "",
    collectionDate: row.collectionDate,
    studentId: row.studentId,
    studentName: `${row.studentLastName}, ${row.studentFirstName}`,
    studentRef: row.studentRef,
    gradeLevel: row.gradeLevel,
    schoolYear: row.schoolYear,
    amount: row.amount,
    paymentMethod: row.paymentMethod,
    referenceNumber: row.referenceNumber,
    status: row.status,
    kind: row.kind,
    remarks: row.remarks,
    processedBy: row.processedBy ?? "System",
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
}): Promise<PaymentCollectionSummary> {
  const { startDate, endDate, schoolYearId, paymentMethod, paymentStatus } =
    params;

  // Build WHERE conditions (same as report query)
  const conditions = buildWhereConditions({
    startDate,
    endDate,
    schoolYearId,
    paymentMethod,
    paymentStatus,
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
 * Maximum 5000 rows to prevent memory issues.
 */
export async function getAllPaymentCollectionData(params: {
  startDate: Date;
  endDate: Date;
  schoolYearId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
}): Promise<PaymentCollectionRow[]> {
  const MAX_PDF_ROWS = 5000;

  const { startDate, endDate, schoolYearId, paymentMethod, paymentStatus } =
    params;

  const conditions = buildWhereConditions({
    startDate,
    endDate,
    schoolYearId,
    paymentMethod,
    paymentStatus,
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
      gradeLevel: gradeLevels.name,
      schoolYear: schoolYears.label,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      referenceNumber: payments.referenceNumber,
      status: payments.status,
      kind: payments.kind,
      remarks: payments.remarks,
      processedBy: cashier.username,
    })
    .from(payments)
    .innerJoin(students, eq(payments.studentId, students.id))
    .innerJoin(assessments, eq(payments.assessmentId, assessments.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .leftJoin(cashier, eq(payments.createdBy, cashier.id))
    .where(and(...conditions))
    .orderBy(asc(payments.paymentDate), asc(payments.orNumber))
    .limit(MAX_PDF_ROWS);

  return results.map((row) => ({
    id: row.id,
    orNumber: row.orNumber ?? "",
    collectionDate: row.collectionDate,
    studentId: row.studentId,
    studentName: `${row.studentLastName}, ${row.studentFirstName}`,
    studentRef: row.studentRef,
    gradeLevel: row.gradeLevel,
    schoolYear: row.schoolYear,
    amount: row.amount,
    paymentMethod: row.paymentMethod,
    referenceNumber: row.referenceNumber,
    status: row.status,
    kind: row.kind,
    remarks: row.remarks,
    processedBy: row.processedBy ?? "System",
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

// ─── Helper Functions ────────────────────────────────────────────────────────

function buildWhereConditions(params: {
  startDate: Date;
  endDate: Date;
  schoolYearId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
}) {
  const { startDate, endDate, schoolYearId, paymentMethod, paymentStatus } =
    params;

  // Base conditions: only actual payments (exclude BFX and reversals), within date range
  const conditions = [
    eq(payments.kind, "payment"),
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

  return conditions;
}
