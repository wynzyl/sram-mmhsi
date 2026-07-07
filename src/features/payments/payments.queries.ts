import "server-only";
import { db } from "@/lib/db";
import {
  assessments,
  enrollments,
  gradeLevels,
  payments,
  receiptBooklets,
  schoolYears,
  students,
  users,
} from "@/lib/db/schema";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, notInArray, sql } from "drizzle-orm";
import { parseOrNumber } from "@/lib/utils/or-number";
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

export type ManualEntrySuggestions = {
  lastManualPaymentDate: string | null;
  suggestedOrNumbers: { bookletId: string; series: string; nextOr: string }[];
};

/**
 * Get suggestions for manual payment entry.
 * Returns the last manual payment date and next available OR numbers from manual_only booklets.
 */
export async function getManualEntrySuggestions(): Promise<ManualEntrySuggestions> {
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

  // 2. Get active manual_only booklets
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
        eq(receiptBooklets.usageMode, "manual_only")
      )
    )
    .orderBy(asc(receiptBooklets.createdAt));

  // 3. For each booklet, compute next available OR number
  const suggestedOrNumbers: { bookletId: string; series: string; nextOr: string }[] = [];

  for (const booklet of manualBooklets) {
    // Find all consumed OR numbers in this booklet's range
    const consumedOrs = await db
      .select({ orNumber: payments.orNumber })
      .from(payments)
      .where(
        and(
          eq(payments.bookletId, booklet.id),
          sql`${payments.orNumber} IS NOT NULL`
        )
      );

    // Parse consumed OR sequences into a Set for O(1) lookup
    const consumedSet = new Set<number>();
    for (const row of consumedOrs) {
      if (row.orNumber) {
        const parsed = parseOrNumber(row.orNumber);
        if (parsed) consumedSet.add(parsed.sequence);
      }
    }

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
