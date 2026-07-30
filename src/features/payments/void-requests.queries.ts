import { db } from "@/lib/db";
import {
  voidRequests,
  payments,
  students,
  users,
  assessments,
} from "@/lib/db/schema";
import { eq, desc, and, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  type PaginationParams,
  type PaginatedResult,
  calculatePagination,
  calculateOffset,
} from "@/lib/types/pagination";

// ─── Types (re-exported from void-requests.types.ts) ───────────────────────────

export type {
  PendingVoidRequest,
  VoidRequestHistoryRow,
  VoidRequestSummary,
  VoidRequestDetail,
} from "./void-requests.types";

import type {
  PendingVoidRequest,
  VoidRequestHistoryRow,
  VoidRequestSummary,
  VoidRequestDetail,
} from "./void-requests.types";

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
 * Converted from raw SQL to typed Drizzle query for better type safety.
 */
export async function listVoidRequestHistory(opts: {
  limit?: number;
  offset?: number;
}): Promise<VoidRequestHistoryRow[]> {
  const { limit = 50, offset = 0 } = opts;

  // Create aliases for the two user joins (requester and decider)
  const requestedByUser = alias(users, "requested_by_user");
  const decidedByUser = alias(users, "decided_by_user");

  const rows = await db
    .select({
      id: voidRequests.id,
      paymentId: voidRequests.paymentId,
      orNumber: payments.orNumber,
      amount: payments.amount,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentRef: students.referenceNumber,
      status: voidRequests.status,
      requestReason: voidRequests.requestReason,
      requestedAt: voidRequests.requestedAt,
      decidedAt: voidRequests.decidedAt,
      decisionRemarks: voidRequests.decisionRemarks,
      cancelledAt: voidRequests.cancelledAt,
      requestedByUsername: requestedByUser.username,
      decidedByUsername: decidedByUser.username,
    })
    .from(voidRequests)
    .innerJoin(payments, eq(voidRequests.paymentId, payments.id))
    .innerJoin(students, eq(payments.studentId, students.id))
    .leftJoin(requestedByUser, eq(voidRequests.requestedBy, requestedByUser.id))
    .leftJoin(decidedByUser, eq(voidRequests.decidedBy, decidedByUser.id))
    .where(ne(voidRequests.status, "pending"))
    .orderBy(desc(sql`COALESCE(${voidRequests.decidedAt}, ${voidRequests.cancelledAt})`))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    id: r.id,
    paymentId: r.paymentId,
    orNumber: r.orNumber,
    amount: r.amount,
    studentName: `${r.studentLastName}, ${r.studentFirstName}`,
    studentRef: r.studentRef,
    status: r.status,
    requestReason: r.requestReason,
    requestedByUsername: r.requestedByUsername ?? "Unknown",
    requestedAt: r.requestedAt.toISOString(),
    decidedByUsername: r.decidedByUsername,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decisionRemarks: r.decisionRemarks,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
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
 * Converted from raw SQL to typed Drizzle query for better type safety.
 */
export async function getVoidRequestById(requestId: string): Promise<VoidRequestDetail | null> {
  // Create aliases for the two user joins (requester and decider)
  const requestedByUser = alias(users, "requested_by_user");
  const decidedByUser = alias(users, "decided_by_user");

  const [row] = await db
    .select({
      // Void request fields
      id: voidRequests.id,
      paymentId: voidRequests.paymentId,
      requestReason: voidRequests.requestReason,
      status: voidRequests.status,
      requestedBy: voidRequests.requestedBy,
      requestedAt: voidRequests.requestedAt,
      decidedBy: voidRequests.decidedBy,
      decidedAt: voidRequests.decidedAt,
      decisionRemarks: voidRequests.decisionRemarks,
      cancelledAt: voidRequests.cancelledAt,
      // Payment fields
      orNumber: payments.orNumber,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      paymentDate: payments.paymentDate,
      paymentStatus: payments.status,
      // Student fields
      studentId: students.id,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentRef: students.referenceNumber,
      // Assessment fields
      assessmentId: assessments.id,
      assessmentBalance: assessments.balance,
      // User fields
      requestedByUsername: requestedByUser.username,
      decidedByUsername: decidedByUser.username,
    })
    .from(voidRequests)
    .innerJoin(payments, eq(voidRequests.paymentId, payments.id))
    .innerJoin(students, eq(payments.studentId, students.id))
    .leftJoin(assessments, eq(payments.assessmentId, assessments.id))
    .leftJoin(requestedByUser, eq(voidRequests.requestedBy, requestedByUser.id))
    .leftJoin(decidedByUser, eq(voidRequests.decidedBy, decidedByUser.id))
    .where(eq(voidRequests.id, requestId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    paymentId: row.paymentId,
    requestReason: row.requestReason,
    status: row.status,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    decisionRemarks: row.decisionRemarks,
    cancelledAt: row.cancelledAt,
    orNumber: row.orNumber,
    amount: row.amount,
    paymentMethod: row.paymentMethod,
    paymentDate: row.paymentDate,
    paymentStatus: row.paymentStatus,
    studentId: row.studentId,
    studentFirstName: row.studentFirstName,
    studentLastName: row.studentLastName,
    studentRef: row.studentRef,
    assessmentId: row.assessmentId,
    assessmentBalance: row.assessmentBalance,
    requestedByUsername: row.requestedByUsername,
    decidedByUsername: row.decidedByUsername,
  };
}

/**
 * Lists pending void requests for a specific user (their own requests) with pagination.
 * Converted from raw SQL to typed Drizzle query for better type safety.
 */
export async function listMyPendingVoidRequests(
  userId: string,
  params: Partial<PaginationParams> = {}
): Promise<PaginatedResult<PendingVoidRequest>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = calculateOffset(page, pageSize);

  const whereCondition = and(
    eq(voidRequests.status, "pending"),
    eq(voidRequests.requestedBy, userId)
  );

  // Run count and data queries in parallel
  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(voidRequests)
      .where(whereCondition),
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
        requestedByUsername: users.username,
        requestedAt: voidRequests.requestedAt,
      })
      .from(voidRequests)
      .innerJoin(payments, eq(voidRequests.paymentId, payments.id))
      .innerJoin(students, eq(payments.studentId, students.id))
      .innerJoin(users, eq(voidRequests.requestedBy, users.id))
      .where(whereCondition)
      .orderBy(desc(voidRequests.requestedAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  const totalRecords = Number(countResult[0]?.count ?? 0);

  const data = rows.map((r) => ({
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
 * Lists void request history for a specific user (their own requests).
 * Converted from raw SQL to typed Drizzle query for better type safety.
 */
export async function listMyVoidRequestHistory(
  userId: string,
  opts: { limit?: number; offset?: number }
): Promise<VoidRequestHistoryRow[]> {
  const { limit = 50, offset = 0 } = opts;

  // Create aliases for the two user joins (requester and decider)
  const requestedByUser = alias(users, "requested_by_user");
  const decidedByUser = alias(users, "decided_by_user");

  const rows = await db
    .select({
      id: voidRequests.id,
      paymentId: voidRequests.paymentId,
      orNumber: payments.orNumber,
      amount: payments.amount,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentRef: students.referenceNumber,
      status: voidRequests.status,
      requestReason: voidRequests.requestReason,
      requestedAt: voidRequests.requestedAt,
      decidedAt: voidRequests.decidedAt,
      decisionRemarks: voidRequests.decisionRemarks,
      cancelledAt: voidRequests.cancelledAt,
      requestedByUsername: requestedByUser.username,
      decidedByUsername: decidedByUser.username,
    })
    .from(voidRequests)
    .innerJoin(payments, eq(voidRequests.paymentId, payments.id))
    .innerJoin(students, eq(payments.studentId, students.id))
    .leftJoin(requestedByUser, eq(voidRequests.requestedBy, requestedByUser.id))
    .leftJoin(decidedByUser, eq(voidRequests.decidedBy, decidedByUser.id))
    .where(
      and(
        ne(voidRequests.status, "pending"),
        eq(voidRequests.requestedBy, userId)
      )
    )
    .orderBy(desc(sql`COALESCE(${voidRequests.decidedAt}, ${voidRequests.cancelledAt})`))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    id: r.id,
    paymentId: r.paymentId,
    orNumber: r.orNumber,
    amount: r.amount,
    studentName: `${r.studentLastName}, ${r.studentFirstName}`,
    studentRef: r.studentRef,
    status: r.status,
    requestReason: r.requestReason,
    requestedByUsername: r.requestedByUsername ?? "Unknown",
    requestedAt: r.requestedAt.toISOString(),
    decidedByUsername: r.decidedByUsername,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decisionRemarks: r.decisionRemarks,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
  }));
}
