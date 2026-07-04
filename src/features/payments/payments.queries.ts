import "server-only";
import { db } from "@/lib/db";
import {
  assessments,
  enrollments,
  gradeLevels,
  payments,
  schoolYears,
  students,
} from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Role } from "@/lib/constants/roles";
import { getPortalStudentIds, getPortalStudentLabels } from "@/lib/queries/portal-student";
import { calculateOffset } from "@/lib/types/pagination";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type CashierQueueRow = {
  assessmentId: string;
  studentName: string;
  referenceNumber: string;
  gradeLevel: string;
  schoolYear: string;
  billingStatus: string;
  balance: number;
  totalPaid: number;
};

export type CashierStats = {
  totalCollectedToday: number;
  pendingPaymentsCount: number;
  studentsAssessed: number;
  totalCollectibles: number;
};

export type RecentCollection = {
  paymentId: string;
  orNumber: string | null;
  amount: number;
  paymentDate: Date;
  studentFirstName: string;
  studentLastName: string;
  assessmentId: string | null;
};

export type CashierQueueData = {
  queue: CashierQueueRow[];
  stats: CashierStats;
  recentCollections: RecentCollection[];
  queueTotalCount: number;
};

export type CashierQueueParams = {
  page?: number;
  pageSize?: number;
};

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

export type PortalPaymentRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentReference: string | null;
  orNumber: string | null;
  amount: number;
  paymentMethod: string;
  paymentDate: string; // ISO (serialized for client)
  status: string;
  paymentReference: string | null;
};

export type PortalPaymentsData = {
  rows: PortalPaymentRow[];
  showStudentColumn: boolean;
  hasLinkedStudents: boolean;
};

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
