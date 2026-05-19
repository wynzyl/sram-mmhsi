import { db } from "@/lib/db";
import { payments, students, assessments, schoolYears } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export type BfxTransferRow = {
  id: string;
  bfxNumber: string;
  transferDate: Date;
  studentId: string;
  studentName: string;
  studentRef: string;
  sourceSchoolYearId: string;
  sourceSchoolYearLabel: string;
  amount: string;
  remarks: string | null;
  createdBy: string | null;
};

export type BfxReportSummary = {
  totalTransfers: number;
  totalAmount: number;
  periodStart: Date;
  periodEnd: Date;
};

/**
 * Get BFX transfers report with filtering.
 * Returns all balance forward receipts within the specified date range.
 */
export async function getBfxTransfersReport(params: {
  startDate: Date;
  endDate: Date;
  schoolYearId?: string;
}): Promise<BfxTransferRow[]> {
  const { startDate, endDate, schoolYearId } = params;

  // Query BFX payments with related data
  const conditions = [
    eq(payments.kind, "balance_forward"),
    eq(payments.status, "balance_forward"),
    gte(payments.paymentDate, startDate),
    lte(payments.paymentDate, endDate),
  ];

  if (schoolYearId) {
    // Filter by source assessment's school year
    conditions.push(eq(assessments.schoolYearId, schoolYearId));
  }

  const results = await db
    .select({
      id: payments.id,
      bfxNumber: payments.referenceNumber,
      transferDate: payments.paymentDate,
      studentId: payments.studentId,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentRef: students.referenceNumber,
      sourceSchoolYearId: assessments.schoolYearId,
      sourceSchoolYearLabel: schoolYears.label,
      amount: payments.amount,
      remarks: payments.remarks,
      createdBy: payments.createdBy,
    })
    .from(payments)
    .innerJoin(students, eq(payments.studentId, students.id))
    .innerJoin(assessments, eq(payments.assessmentId, assessments.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .where(and(...conditions))
    .orderBy(desc(payments.paymentDate));

  return results.map((row) => ({
    id: row.id,
    bfxNumber: row.bfxNumber ?? "",
    transferDate: row.transferDate,
    studentId: row.studentId,
    studentName: `${row.studentLastName}, ${row.studentFirstName}`,
    studentRef: row.studentRef,
    sourceSchoolYearId: row.sourceSchoolYearId,
    sourceSchoolYearLabel: row.sourceSchoolYearLabel,
    amount: row.amount,
    remarks: row.remarks,
    createdBy: row.createdBy,
  }));
}

/**
 * Get summary statistics for BFX transfers within a date range.
 */
export async function getBfxSummary(params: {
  startDate: Date;
  endDate: Date;
  schoolYearId?: string;
}): Promise<BfxReportSummary> {
  const { startDate, endDate, schoolYearId } = params;

  const conditions = [
    eq(payments.kind, "balance_forward"),
    eq(payments.status, "balance_forward"),
    gte(payments.paymentDate, startDate),
    lte(payments.paymentDate, endDate),
  ];

  if (schoolYearId) {
    conditions.push(eq(assessments.schoolYearId, schoolYearId));
  }

  const result = await db
    .select({
      totalTransfers: sql<number>`COUNT(*)::int`,
      totalAmount: sql<number>`COALESCE(SUM(ABS(${payments.amount}::numeric)), 0)::numeric`,
    })
    .from(payments)
    .innerJoin(assessments, eq(payments.assessmentId, assessments.id))
    .where(and(...conditions));

  const summary = result[0] ?? { totalTransfers: 0, totalAmount: 0 };

  return {
    totalTransfers: summary.totalTransfers,
    totalAmount: Number(summary.totalAmount),
    periodStart: startDate,
    periodEnd: endDate,
  };
}

/**
 * Get all school years for the filter dropdown.
 */
export async function getSchoolYearsForBfxReport(): Promise<
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
