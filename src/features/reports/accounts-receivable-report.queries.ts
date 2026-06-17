import { db } from "@/lib/db";
import {
  students,
  assessments,
  schoolYears,
  enrollments,
  payments,
} from "@/lib/db/schema";
import { eq, and, asc, desc, isNull, sql } from "drizzle-orm";
import { calculateOffset } from "@/lib/types/pagination";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AccountsReceivableRow = {
  studentId: string;
  studentRef: string; // user-facing 7-digit Student ID
  studentName: string; // "DELA CRUZ, Juan Miguel" (Lastname, Firstname Middlename)
  schoolYearLabel: string; // e.g. "2025-2026"
  balance: number; // outstanding balance (assessments.balance)
  lastPaymentDate: Date | null; // most recent posted payment, null if none
  agingDays: number; // today − (lastPaymentDate ?? assessment.createdAt)
};

export type AccountsReceivableSummary = {
  totalAccounts: number;
  totalOutstanding: number;
};

export type AccountsReceivableParams = {
  schoolYearId?: string;
  page?: number;
  pageSize?: number;
};

export type AccountsReceivableResult = {
  rows: AccountsReceivableRow[];
  totalCount: number;
};

const MS_PER_DAY = 86_400_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Outstanding ledgers for currently enrolled students only.
 * `billingStatus = 'outstanding'` already implies a positive balance and
 * excludes cancelled / transferred / fully-paid ledgers; the enrollment join
 * further restricts to `status = 'enrolled'`. Every query using these
 * conditions must `innerJoin(enrollments)` on `assessments.enrollmentId`.
 */
function buildConditions(schoolYearId?: string) {
  return and(
    eq(assessments.billingStatus, "outstanding"),
    eq(enrollments.status, "enrolled"),
    isNull(students.deletedAt),
    schoolYearId ? eq(assessments.schoolYearId, schoolYearId) : undefined,
  );
}

/**
 * Most recent *posted* payment per assessment. Voided/reversed/BFX rows don't
 * count toward aging. LEFT JOINed so never-paid assessments still appear.
 */
function lastPaymentSubquery() {
  return db
    .select({
      assessmentId: payments.assessmentId,
      lastPaymentDate:
        sql<string | null>`MAX(${payments.paymentDate})`.as("last_payment_date"),
    })
    .from(payments)
    .where(and(eq(payments.kind, "payment"), eq(payments.status, "posted")))
    .groupBy(payments.assessmentId)
    .as("last_payment");
}

const SELECT_SHAPE = (lastPayment: ReturnType<typeof lastPaymentSubquery>) => ({
  studentId: students.id,
  studentRef: students.referenceNumber,
  studentFirstName: students.firstName,
  studentMiddleName: students.middleName,
  studentLastName: students.lastName,
  schoolYearLabel: schoolYears.label,
  balance: assessments.balance,
  assessmentCreatedAt: assessments.createdAt,
  lastPaymentDate: lastPayment.lastPaymentDate,
});

const ORDER_BY = [
  desc(schoolYears.startDate),
  desc(assessments.balance),
  asc(students.lastName),
  asc(students.firstName),
];

function mapRow(row: {
  studentId: string;
  studentRef: string;
  studentFirstName: string;
  studentMiddleName: string | null;
  studentLastName: string;
  schoolYearLabel: string;
  balance: string;
  assessmentCreatedAt: Date;
  lastPaymentDate: string | Date | null;
}): AccountsReceivableRow {
  const firstAndMiddle = `${row.studentFirstName}${
    row.studentMiddleName ? ` ${row.studentMiddleName}` : ""
  }`;

  const lastPaymentDate = row.lastPaymentDate
    ? new Date(row.lastPaymentDate)
    : null;

  // Age from the last payment, or the assessment date when nothing's been paid.
  const referenceDate = lastPaymentDate ?? new Date(row.assessmentCreatedAt);
  const agingDays = Math.max(
    0,
    Math.floor((Date.now() - referenceDate.getTime()) / MS_PER_DAY),
  );

  return {
    studentId: row.studentId,
    studentRef: row.studentRef,
    studentName: `${row.studentLastName}, ${firstAndMiddle}`,
    schoolYearLabel: row.schoolYearLabel,
    balance: Number(row.balance),
    lastPaymentDate,
    agingDays,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Paginated accounts-receivable list for the on-screen preview.
 * Students with an outstanding balance, optionally filtered to one school year.
 */
export async function getAccountsReceivableReport(
  params: AccountsReceivableParams,
): Promise<AccountsReceivableResult> {
  const { schoolYearId } = params;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = calculateOffset(page, pageSize);

  const lastPayment = lastPaymentSubquery();

  const [results, countResult] = await Promise.all([
    db
      .select(SELECT_SHAPE(lastPayment))
      .from(assessments)
      .innerJoin(students, eq(assessments.studentId, students.id))
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
      .leftJoin(lastPayment, eq(lastPayment.assessmentId, assessments.id))
      .where(buildConditions(schoolYearId))
      .orderBy(...ORDER_BY)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(assessments)
      .innerJoin(students, eq(assessments.studentId, students.id))
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .where(buildConditions(schoolYearId))
      .then((r) => r[0]),
  ]);

  return {
    rows: results.map(mapRow),
    totalCount: countResult?.count ?? 0,
  };
}

/**
 * All outstanding accounts for export (no pagination). Capped at 5000 rows to
 * match the other reports' memory guard.
 */
export async function getAllAccountsReceivableData(params: {
  schoolYearId?: string;
}): Promise<AccountsReceivableRow[]> {
  const MAX_EXPORT_ROWS = 5000;
  const lastPayment = lastPaymentSubquery();

  const results = await db
    .select(SELECT_SHAPE(lastPayment))
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .leftJoin(lastPayment, eq(lastPayment.assessmentId, assessments.id))
    .where(buildConditions(params.schoolYearId))
    .orderBy(...ORDER_BY)
    .limit(MAX_EXPORT_ROWS);

  return results.map(mapRow);
}

/**
 * Outstanding totals: number of accounts and the summed outstanding balance.
 */
export async function getAccountsReceivableSummary(params: {
  schoolYearId?: string;
}): Promise<AccountsReceivableSummary> {
  const summaryResult = await db
    .select({
      totalAccounts: sql<number>`COUNT(*)::int`,
      totalOutstanding: sql<number>`COALESCE(SUM(${assessments.balance}::numeric), 0)::numeric`,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .where(buildConditions(params.schoolYearId));

  const summary = summaryResult[0] ?? { totalAccounts: 0, totalOutstanding: 0 };

  return {
    totalAccounts: summary.totalAccounts,
    totalOutstanding: Number(summary.totalOutstanding),
  };
}
