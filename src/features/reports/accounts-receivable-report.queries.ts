import "server-only";
import { db } from "@/lib/db";
import {
  students,
  assessments,
  schoolYears,
  enrollments,
  payments,
  gradeLevels,
} from "@/lib/db/schema";
import { eq, and, asc, desc, isNull, sql, or, ilike } from "drizzle-orm";
import { calculateOffset } from "@/lib/types/pagination";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AccountsReceivableRow = {
  studentId: string;
  studentRef: string; // user-facing 7-digit Student ID
  studentName: string; // "SURNAME, Firstname Middlename"
  schoolYearLabel: string; // e.g., "2025-2026"
  gradeLevelId: string;
  gradeLevelName: string; // e.g., "Grade 7"
  gradeLevelOrder: number; // for sorting
  totalAmount: number; // from assessments.totalAmount
  totalPaid: number; // from assessments.totalPaid
  balance: number; // outstanding balance (assessments.balance)
  lastOrNumber: string | null; // most recent OR number
  orDate: Date | null; // date of last payment
};

export type AccountsReceivableGrouped = {
  gradeLevelId: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  rows: AccountsReceivableRow[];
  subtotal: {
    totalAmount: number;
    totalPaid: number;
    totalBalance: number;
    studentCount: number;
  };
};

export type AccountsReceivableSummary = {
  totalAccounts: number;
  totalOutstanding: number;
  totalAssessed: number;
  totalPaid: number;
};

export type AccountsReceivableParams = {
  schoolYearId?: string;
  gradeLevelId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type AccountsReceivableResult = {
  rows: AccountsReceivableRow[];
  totalCount: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Outstanding ledgers for currently enrolled students only.
 * `billingStatus = 'outstanding'` already implies a positive balance and
 * excludes cancelled / transferred / fully-paid ledgers; the enrollment join
 * further restricts to `status = 'enrolled'`. Every query using these
 * conditions must `innerJoin(enrollments)` on `assessments.enrollmentId`.
 */
function buildConditions(
  schoolYearId?: string,
  gradeLevelId?: string,
  search?: string,
) {
  // Build search condition: match against student reference number or name parts
  const searchCondition = search?.trim()
    ? or(
        ilike(students.referenceNumber, `%${search.trim()}%`),
        ilike(students.lastName, `%${search.trim()}%`),
        ilike(students.firstName, `%${search.trim()}%`),
      )
    : undefined;

  return and(
    eq(assessments.billingStatus, "outstanding"),
    eq(enrollments.status, "enrolled"),
    isNull(students.deletedAt),
    schoolYearId ? eq(assessments.schoolYearId, schoolYearId) : undefined,
    gradeLevelId ? eq(enrollments.gradeLevelId, gradeLevelId) : undefined,
    searchCondition,
  );
}

/**
 * Most recent *posted* payment per assessment with OR number and date.
 * Uses a subquery to get the latest payment by date.
 * LEFT JOINed so never-paid assessments still appear.
 */
function lastPaymentWithOrSubquery() {
  // Subquery to get the max payment date per assessment
  const maxPaymentDate = db
    .select({
      assessmentId: payments.assessmentId,
      maxDate: sql<string>`MAX(${payments.paymentDate})`.as("max_date"),
    })
    .from(payments)
    .where(and(eq(payments.kind, "payment"), eq(payments.status, "posted")))
    .groupBy(payments.assessmentId)
    .as("max_payment");

  // Join back to get the OR number for that date
  return db
    .select({
      assessmentId: payments.assessmentId,
      orNumber: payments.orNumber,
      paymentDate: payments.paymentDate,
    })
    .from(payments)
    .innerJoin(
      maxPaymentDate,
      and(
        eq(payments.assessmentId, maxPaymentDate.assessmentId),
        eq(payments.paymentDate, sql`${maxPaymentDate.maxDate}::timestamp`),
      ),
    )
    .where(and(eq(payments.kind, "payment"), eq(payments.status, "posted")))
    .as("last_payment");
}

const SELECT_SHAPE = (lastPayment: ReturnType<typeof lastPaymentWithOrSubquery>) => ({
  studentId: students.id,
  studentRef: students.referenceNumber,
  studentFirstName: students.firstName,
  studentMiddleName: students.middleName,
  studentLastName: students.lastName,
  schoolYearLabel: schoolYears.label,
  gradeLevelId: gradeLevels.id,
  gradeLevelName: gradeLevels.name,
  gradeLevelOrder: gradeLevels.order,
  totalAmount: assessments.totalAmount,
  totalPaid: assessments.totalPaid,
  balance: assessments.balance,
  orNumber: lastPayment.orNumber,
  paymentDate: lastPayment.paymentDate,
});

const ORDER_BY = [
  asc(gradeLevels.order), // Primary: grade level
  asc(students.lastName), // Secondary: surname
  asc(students.firstName), // Tertiary: first name
];

function mapRow(row: {
  studentId: string;
  studentRef: string;
  studentFirstName: string;
  studentMiddleName: string | null;
  studentLastName: string;
  schoolYearLabel: string;
  gradeLevelId: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  totalAmount: string;
  totalPaid: string;
  balance: string;
  orNumber: string | null;
  paymentDate: Date | null;
}): AccountsReceivableRow {
  const firstAndMiddle = `${row.studentFirstName}${
    row.studentMiddleName ? ` ${row.studentMiddleName}` : ""
  }`;

  return {
    studentId: row.studentId,
    studentRef: row.studentRef,
    studentName: `${row.studentLastName}, ${firstAndMiddle}`,
    schoolYearLabel: row.schoolYearLabel,
    gradeLevelId: row.gradeLevelId,
    gradeLevelName: row.gradeLevelName,
    gradeLevelOrder: row.gradeLevelOrder,
    totalAmount: Number(row.totalAmount),
    totalPaid: Number(row.totalPaid),
    balance: Number(row.balance),
    lastOrNumber: row.orNumber,
    orDate: row.paymentDate ? new Date(row.paymentDate) : null,
  };
}

/**
 * Groups flat rows by grade level with subtotals.
 */
export function groupByGradeLevel(
  rows: AccountsReceivableRow[],
): AccountsReceivableGrouped[] {
  const groupMap = new Map<string, AccountsReceivableGrouped>();

  for (const row of rows) {
    let group = groupMap.get(row.gradeLevelId);
    if (!group) {
      group = {
        gradeLevelId: row.gradeLevelId,
        gradeLevelName: row.gradeLevelName,
        gradeLevelOrder: row.gradeLevelOrder,
        rows: [],
        subtotal: {
          totalAmount: 0,
          totalPaid: 0,
          totalBalance: 0,
          studentCount: 0,
        },
      };
      groupMap.set(row.gradeLevelId, group);
    }
    group.rows.push(row);
    group.subtotal.totalAmount += row.totalAmount;
    group.subtotal.totalPaid += row.totalPaid;
    group.subtotal.totalBalance += row.balance;
    group.subtotal.studentCount += 1;
  }

  // Sort groups by grade level order
  return Array.from(groupMap.values()).sort(
    (a, b) => a.gradeLevelOrder - b.gradeLevelOrder,
  );
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Paginated accounts-receivable list for the on-screen preview.
 * Students with an outstanding balance, optionally filtered to one school year
 * and/or grade level.
 */
export async function getAccountsReceivableReport(
  params: AccountsReceivableParams,
): Promise<AccountsReceivableResult> {
  const { schoolYearId, gradeLevelId, search } = params;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = calculateOffset(page, pageSize);

  const lastPayment = lastPaymentWithOrSubquery();
  const conditions = buildConditions(schoolYearId, gradeLevelId, search);

  const [results, countResult] = await Promise.all([
    db
      .select(SELECT_SHAPE(lastPayment))
      .from(assessments)
      .innerJoin(students, eq(assessments.studentId, students.id))
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
      .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
      .leftJoin(lastPayment, eq(lastPayment.assessmentId, assessments.id))
      .where(conditions)
      .orderBy(...ORDER_BY)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(assessments)
      .innerJoin(students, eq(assessments.studentId, students.id))
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
      .where(conditions)
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
  gradeLevelId?: string;
  search?: string;
}): Promise<AccountsReceivableRow[]> {
  const MAX_EXPORT_ROWS = 5000;
  const lastPayment = lastPaymentWithOrSubquery();

  const results = await db
    .select(SELECT_SHAPE(lastPayment))
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .leftJoin(lastPayment, eq(lastPayment.assessmentId, assessments.id))
    .where(buildConditions(params.schoolYearId, params.gradeLevelId, params.search))
    .orderBy(...ORDER_BY)
    .limit(MAX_EXPORT_ROWS);

  return results.map(mapRow);
}

/**
 * Outstanding totals: number of accounts, summed outstanding balance,
 * total assessed, and total paid.
 */
export async function getAccountsReceivableSummary(params: {
  schoolYearId?: string;
  gradeLevelId?: string;
  search?: string;
}): Promise<AccountsReceivableSummary> {
  const summaryResult = await db
    .select({
      totalAccounts: sql<number>`COUNT(*)::int`,
      totalOutstanding: sql<number>`COALESCE(SUM(${assessments.balance}::numeric), 0)::numeric`,
      totalAssessed: sql<number>`COALESCE(SUM(${assessments.totalAmount}::numeric), 0)::numeric`,
      totalPaid: sql<number>`COALESCE(SUM(${assessments.totalPaid}::numeric), 0)::numeric`,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(buildConditions(params.schoolYearId, params.gradeLevelId, params.search));

  const summary = summaryResult[0] ?? {
    totalAccounts: 0,
    totalOutstanding: 0,
    totalAssessed: 0,
    totalPaid: 0,
  };

  return {
    totalAccounts: summary.totalAccounts,
    totalOutstanding: Number(summary.totalOutstanding),
    totalAssessed: Number(summary.totalAssessed),
    totalPaid: Number(summary.totalPaid),
  };
}
