import { db } from "@/lib/db";
import {
  voidRequests,
  payments,
  students,
  users,
} from "@/lib/db/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import {
  type PaginationParams,
  type PaginatedResult,
  calculatePagination,
  calculateOffset,
} from "@/lib/types/pagination";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PendingVoidRequest = {
  id: string;
  paymentId: string;
  orNumber: string | null;
  amount: string;
  paymentMethod: string;
  paymentDate: string;
  studentId: string;
  studentName: string;
  studentRef: string;
  requestReason: string;
  requestedBy: string;
  requestedByUsername: string;
  requestedAt: string;
};

export type VoidRequestHistoryRow = {
  id: string;
  paymentId: string;
  orNumber: string | null;
  amount: string;
  studentName: string;
  studentRef: string;
  status: string;
  requestReason: string;
  requestedByUsername: string;
  requestedAt: string;
  decidedByUsername: string | null;
  decidedAt: string | null;
  decisionRemarks: string | null;
  cancelledAt: string | null;
};

export type VoidRequestSummary = {
  requestId: string;
  requestedBy: string;
  requestedByUsername: string;
  requestedAt: string;
  status: string;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Lists all pending void requests for the admin inbox with pagination.
 */
export async function listPendingVoidRequests(
  params: Partial<PaginationParams> = {}
): Promise<PaginatedResult<PendingVoidRequest>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = calculateOffset(page, pageSize);

  const requestedByUser = db
    .select({
      id: users.id,
      username: users.username,
    })
    .from(users)
    .as("requested_by_user");

  // Run count and data queries in parallel
  const [countResult, results] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(voidRequests)
      .where(eq(voidRequests.status, "pending")),
    db
      .select({
        id: voidRequests.id,
        paymentId: voidRequests.paymentId,
        orNumber: payments.orNumber,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        paymentDate: payments.paymentDate,
        studentId: students.id,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        studentRef: students.referenceNumber,
        requestReason: voidRequests.requestReason,
        requestedBy: voidRequests.requestedBy,
        requestedByUsername: requestedByUser.username,
        requestedAt: voidRequests.requestedAt,
      })
      .from(voidRequests)
      .innerJoin(payments, eq(voidRequests.paymentId, payments.id))
      .innerJoin(students, eq(payments.studentId, students.id))
      .innerJoin(requestedByUser, eq(voidRequests.requestedBy, requestedByUser.id))
      .where(eq(voidRequests.status, "pending"))
      .orderBy(desc(voidRequests.requestedAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  const totalRecords = Number(countResult[0]?.count ?? 0);

  const data = results.map((r) => ({
    id: r.id,
    paymentId: r.paymentId,
    orNumber: r.orNumber,
    amount: r.amount,
    paymentMethod: r.paymentMethod,
    paymentDate: r.paymentDate.toISOString(),
    studentId: r.studentId,
    studentName: `${r.studentLastName}, ${r.studentFirstName}`,
    studentRef: r.studentRef,
    requestReason: r.requestReason,
    requestedBy: r.requestedBy,
    requestedByUsername: r.requestedByUsername,
    requestedAt: r.requestedAt.toISOString(),
  }));

  return {
    data,
    pagination: calculatePagination(page, pageSize, totalRecords),
  };
}

/**
 * Lists void request history (approved, rejected, cancelled).
 */
export async function listVoidRequestHistory(opts: {
  limit?: number;
  offset?: number;
}): Promise<VoidRequestHistoryRow[]> {
  const { limit = 50, offset = 0 } = opts;

  // Use aliases for the two user joins (requester and decider)
  const rows = await db.execute(sql`
    SELECT
      vr.id,
      vr.payment_id,
      p.or_number,
      p.amount,
      s.first_name,
      s.last_name,
      s.reference_number as student_ref,
      vr.status,
      vr.request_reason,
      vr.requested_at,
      vr.decided_at,
      vr.decision_remarks,
      vr.cancelled_at,
      req_user.username as requested_by_username,
      dec_user.username as decided_by_username
    FROM void_requests vr
    INNER JOIN payments p ON vr.payment_id = p.id
    INNER JOIN students s ON p.student_id = s.id
    LEFT JOIN users req_user ON vr.requested_by = req_user.id
    LEFT JOIN users dec_user ON vr.decided_by = dec_user.id
    WHERE vr.status != 'pending'
    ORDER BY COALESCE(vr.decided_at, vr.cancelled_at) DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  if (!rows || rows.length === 0) {
    return [];
  }

  return Array.from(rows).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    paymentId: String(r.payment_id),
    orNumber: r.or_number != null ? String(r.or_number) : null,
    amount: String(r.amount),
    studentName: `${r.last_name}, ${r.first_name}`,
    studentRef: String(r.student_ref),
    status: String(r.status),
    requestReason: String(r.request_reason),
    requestedByUsername: String(r.requested_by_username ?? "Unknown"),
    requestedAt: r.requested_at instanceof Date
      ? r.requested_at.toISOString()
      : String(r.requested_at),
    decidedByUsername: r.decided_by_username != null ? String(r.decided_by_username) : null,
    decidedAt: r.decided_at != null
      ? (r.decided_at instanceof Date ? r.decided_at.toISOString() : String(r.decided_at))
      : null,
    decisionRemarks: r.decision_remarks != null ? String(r.decision_remarks) : null,
    cancelledAt: r.cancelled_at != null
      ? (r.cancelled_at instanceof Date ? r.cancelled_at.toISOString() : String(r.cancelled_at))
      : null,
  }));
}

/**
 * Gets pending void requests for a set of payment IDs.
 * Used to display pending status badges in payment tables.
 */
export async function getPendingVoidRequestsForPayments(
  paymentIds: string[]
): Promise<Map<string, VoidRequestSummary>> {
  if (paymentIds.length === 0) {
    return new Map();
  }

  const results = await db
    .select({
      id: voidRequests.id,
      paymentId: voidRequests.paymentId,
      requestedBy: voidRequests.requestedBy,
      requestedByUsername: users.username,
      requestedAt: voidRequests.requestedAt,
      status: voidRequests.status,
    })
    .from(voidRequests)
    .innerJoin(users, eq(voidRequests.requestedBy, users.id))
    .where(
      and(
        inArray(voidRequests.paymentId, paymentIds),
        eq(voidRequests.status, "pending")
      )
    );

  const map = new Map<string, VoidRequestSummary>();
  for (const r of results) {
    map.set(r.paymentId, {
      requestId: r.id,
      requestedBy: r.requestedBy,
      requestedByUsername: r.requestedByUsername,
      requestedAt: r.requestedAt.toISOString(),
      status: r.status,
    });
  }
  return map;
}

/**
 * Counts pending void requests (for navigation badge).
 */
export async function countPendingVoidRequests(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(voidRequests)
    .where(eq(voidRequests.status, "pending"));

  return Number(result[0]?.count ?? 0);
}

/**
 * Gets a single void request by ID with full details.
 */
export async function getVoidRequestById(requestId: string) {
  // Explicit column selection - excludes unused audit columns (reversalPaymentId)
  const rows = await db.execute(sql`
    SELECT
      vr.id,
      vr.payment_id,
      vr.request_reason,
      vr.status,
      vr.requested_by,
      vr.requested_at,
      vr.decided_by,
      vr.decided_at,
      vr.decision_remarks,
      vr.cancelled_at,
      p.or_number,
      p.amount,
      p.payment_method,
      p.payment_date,
      p.status as payment_status,
      s.id as student_id,
      s.first_name as student_first_name,
      s.last_name as student_last_name,
      s.reference_number as student_ref,
      a.id as assessment_id,
      a.balance as assessment_balance,
      req_user.username as requested_by_username,
      dec_user.username as decided_by_username
    FROM void_requests vr
    INNER JOIN payments p ON vr.payment_id = p.id
    INNER JOIN students s ON p.student_id = s.id
    LEFT JOIN assessments a ON p.assessment_id = a.id
    LEFT JOIN users req_user ON vr.requested_by = req_user.id
    LEFT JOIN users dec_user ON vr.decided_by = dec_user.id
    WHERE vr.id = ${requestId}
    LIMIT 1
  `);

  if (!rows || rows.length === 0) {
    return null;
  }

  return rows[0];
}

/**
 * Lists pending void requests for a specific user (their own requests) with pagination.
 */
export async function listMyPendingVoidRequests(
  userId: string,
  params: Partial<PaginationParams> = {}
): Promise<PaginatedResult<PendingVoidRequest>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = calculateOffset(page, pageSize);

  // Run count and data queries in parallel
  const [countResult, rows] = await Promise.all([
    db.execute(sql`
      SELECT count(*) as count
      FROM void_requests vr
      WHERE vr.status = 'pending' AND vr.requested_by = ${userId}
    `),
    db.execute(sql`
      SELECT
        vr.id,
        vr.payment_id,
        p.or_number,
        p.amount,
        p.payment_method,
        p.payment_date,
        s.id as student_id,
        s.first_name,
        s.last_name,
        s.reference_number as student_ref,
        vr.request_reason,
        vr.requested_by,
        u.username as requested_by_username,
        vr.requested_at
      FROM void_requests vr
      INNER JOIN payments p ON vr.payment_id = p.id
      INNER JOIN students s ON p.student_id = s.id
      INNER JOIN users u ON vr.requested_by = u.id
      WHERE vr.status = 'pending' AND vr.requested_by = ${userId}
      ORDER BY vr.requested_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `),
  ]);

  const totalRecords = Number((countResult[0] as Record<string, unknown>)?.count ?? 0);

  const data = !rows || rows.length === 0
    ? []
    : Array.from(rows).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        paymentId: String(r.payment_id),
        orNumber: r.or_number != null ? String(r.or_number) : null,
        amount: String(r.amount),
        paymentMethod: String(r.payment_method),
        paymentDate: r.payment_date instanceof Date
          ? r.payment_date.toISOString()
          : String(r.payment_date),
        studentId: String(r.student_id),
        studentName: `${r.last_name}, ${r.first_name}`,
        studentRef: String(r.student_ref),
        requestReason: String(r.request_reason),
        requestedBy: String(r.requested_by),
        requestedByUsername: String(r.requested_by_username),
        requestedAt: r.requested_at instanceof Date
          ? r.requested_at.toISOString()
          : String(r.requested_at),
      }));

  return {
    data,
    pagination: calculatePagination(page, pageSize, totalRecords),
  };
}

/**
 * Lists void request history for a specific user (their own requests).
 */
export async function listMyVoidRequestHistory(
  userId: string,
  opts: { limit?: number; offset?: number }
): Promise<VoidRequestHistoryRow[]> {
  const { limit = 50, offset = 0 } = opts;

  const rows = await db.execute(sql`
    SELECT
      vr.id,
      vr.payment_id,
      p.or_number,
      p.amount,
      s.first_name,
      s.last_name,
      s.reference_number as student_ref,
      vr.status,
      vr.request_reason,
      vr.requested_at,
      vr.decided_at,
      vr.decision_remarks,
      vr.cancelled_at,
      req_user.username as requested_by_username,
      dec_user.username as decided_by_username
    FROM void_requests vr
    INNER JOIN payments p ON vr.payment_id = p.id
    INNER JOIN students s ON p.student_id = s.id
    LEFT JOIN users req_user ON vr.requested_by = req_user.id
    LEFT JOIN users dec_user ON vr.decided_by = dec_user.id
    WHERE vr.status != 'pending' AND vr.requested_by = ${userId}
    ORDER BY COALESCE(vr.decided_at, vr.cancelled_at) DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  if (!rows || rows.length === 0) {
    return [];
  }

  return Array.from(rows).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    paymentId: String(r.payment_id),
    orNumber: r.or_number != null ? String(r.or_number) : null,
    amount: String(r.amount),
    studentName: `${r.last_name}, ${r.first_name}`,
    studentRef: String(r.student_ref),
    status: String(r.status),
    requestReason: String(r.request_reason),
    requestedByUsername: String(r.requested_by_username ?? "Unknown"),
    requestedAt: r.requested_at instanceof Date
      ? r.requested_at.toISOString()
      : String(r.requested_at),
    decidedByUsername: r.decided_by_username != null ? String(r.decided_by_username) : null,
    decidedAt: r.decided_at != null
      ? (r.decided_at instanceof Date ? r.decided_at.toISOString() : String(r.decided_at))
      : null,
    decisionRemarks: r.decision_remarks != null ? String(r.decision_remarks) : null,
    cancelledAt: r.cancelled_at != null
      ? (r.cancelled_at instanceof Date ? r.cancelled_at.toISOString() : String(r.cancelled_at))
      : null,
  }));
}
