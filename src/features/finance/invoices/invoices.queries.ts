"use server";

import { db } from "@/lib/db";
import {
  assessments,
  enrollments,
  invoices,
  sections,
  students,
  gradeLevels,
  parentsGuardians,
  studentGuardianLinks,
} from "@/lib/db/schema";
import { eq, and, isNull, gt, sql, ne, notExists, inArray, or, desc, ilike } from "drizzle-orm";
import type { BatchGenerateInvoicesInput } from "./invoices.schema";
import type { PaginationParams, PaginatedResult } from "@/lib/types/pagination";
import { calculatePagination, calculateOffset } from "@/lib/types/pagination";

// ─── Invoice Tab Types ─────────────────────────────────────────────────────────

export type InvoiceTabKey = "draft" | "sent" | "viewed" | "overdue";

export type InvoiceTabCounts = {
  draft: number;
  sent: number;
  viewed: number;
  overdue: number;
};

export type InvoiceListRow = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  studentRef: string;
  amountDue: number;
  status: "draft" | "sent" | "viewed" | "settled" | "overdue";
  dueDate: Date | null;
  createdAt: Date;
  gradeLevelName: string;
  sectionName: string | null;
};

export type InvoiceFilters = {
  search?: string;
  gradeLevelId?: string;
};

// ─── Invoice Listing Queries ───────────────────────────────────────────────────

/**
 * Get invoice tab counts for the active school year.
 * Used for tab badges in the invoice queue header.
 */
export async function getInvoiceTabCounts(
  schoolYearId: string
): Promise<InvoiceTabCounts> {
  const todayIso = new Date().toISOString();

  const [counts] = await db
    .select({
      draft: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'draft')::int`,
      sent: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'sent')::int`,
      viewed: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'viewed')::int`,
      overdue: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'overdue' OR (${invoices.status} IN ('sent', 'viewed') AND ${invoices.dueDate} < ${todayIso}::timestamp))::int`,
    })
    .from(invoices)
    .innerJoin(assessments, eq(invoices.assessmentId, assessments.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .where(
      and(
        eq(enrollments.schoolYearId, schoolYearId),
        ne(invoices.status, "settled")
      )
    );

  return {
    draft: counts?.draft ?? 0,
    sent: counts?.sent ?? 0,
    viewed: counts?.viewed ?? 0,
    overdue: counts?.overdue ?? 0,
  };
}

/**
 * Get paginated invoices for a specific tab/status.
 * Supports search and grade level filtering.
 */
export async function getInvoicesByTab(
  tab: InvoiceTabKey,
  schoolYearId: string,
  pagination: PaginationParams,
  filters: InvoiceFilters = {}
): Promise<PaginatedResult<InvoiceListRow>> {
  const { page, pageSize } = pagination;
  const { search, gradeLevelId } = filters;
  const todayIso = new Date().toISOString();

  // Build status condition based on tab
  let statusCondition;
  switch (tab) {
    case "draft":
      statusCondition = eq(invoices.status, "draft");
      break;
    case "sent":
      statusCondition = eq(invoices.status, "sent");
      break;
    case "viewed":
      statusCondition = eq(invoices.status, "viewed");
      break;
    case "overdue":
      // Include explicit overdue status + sent/viewed with past due date
      statusCondition = or(
        eq(invoices.status, "overdue"),
        and(
          or(eq(invoices.status, "sent"), eq(invoices.status, "viewed")),
          sql`${invoices.dueDate} < ${todayIso}::timestamp`
        )
      );
      break;
  }

  // Build conditions array
  const conditions = [
    eq(enrollments.schoolYearId, schoolYearId),
    ne(invoices.status, "settled"),
    isNull(students.deletedAt),
    statusCondition,
  ];

  // Add search filter
  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        ilike(students.firstName, searchPattern),
        ilike(students.lastName, searchPattern),
        ilike(students.referenceNumber, searchPattern),
        ilike(invoices.invoiceNumber, searchPattern)
      )!
    );
  }

  // Add grade level filter
  if (gradeLevelId) {
    conditions.push(eq(enrollments.gradeLevelId, gradeLevelId));
  }

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(invoices)
    .innerJoin(assessments, eq(invoices.assessmentId, assessments.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(students, eq(invoices.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(and(...conditions));

  const totalRecords = countResult?.count ?? 0;

  // Get paginated data
  const offset = calculateOffset(page, pageSize);
  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      studentId: invoices.studentId,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      studentRef: students.referenceNumber,
      amountDue: invoices.amountDue,
      status: invoices.status,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      gradeLevelName: gradeLevels.name,
      sectionName: sections.name,
    })
    .from(invoices)
    .innerJoin(assessments, eq(invoices.assessmentId, assessments.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(students, eq(invoices.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(and(...conditions))
    .orderBy(desc(invoices.createdAt))
    .limit(pageSize)
    .offset(offset);

  const data: InvoiceListRow[] = rows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    studentId: row.studentId,
    studentName: formatStudentName(row),
    studentRef: row.studentRef,
    amountDue: Number(row.amountDue),
    status: row.status,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    gradeLevelName: row.gradeLevelName,
    sectionName: row.sectionName,
  }));

  return {
    data,
    pagination: calculatePagination(page, pageSize, totalRecords),
  };
}

export type BatchInvoiceCandidate = {
  assessmentId: string;
  studentId: string;
  studentName: string;
  studentRef: string;
  balance: string;
  gradeLevelName: string;
  sectionName: string | null;
};

/**
 * Get assessments eligible for batch invoicing.
 * Filters by grade level (required) and optional section.
 * Excludes assessments that already have invoices.
 * Excludes cancelled assessments and zero-balance assessments.
 *
 * @param params - Filter parameters
 * @returns Array of assessment IDs with student info
 */
export async function getAssessmentsForBatchInvoicing(
  params: BatchGenerateInvoicesInput
): Promise<BatchInvoiceCandidate[]> {
  const { gradeLevelId, sectionId, schoolYearId } = params;

  // Build dynamic conditions
  const conditions = [
    eq(enrollments.gradeLevelId, gradeLevelId),
    isNull(assessments.cancelledAt),
    isNull(assessments.transferredAt),
    gt(assessments.balance, "0"),
    isNull(students.deletedAt),
    ne(enrollments.status, "cancelled"),
  ];

  // Add optional section filter
  if (sectionId) {
    conditions.push(eq(enrollments.sectionId, sectionId));
  }

  // Add optional school year filter (use active school year if not provided)
  if (schoolYearId) {
    conditions.push(eq(enrollments.schoolYearId, schoolYearId));
  }

  const rows = await db
    .select({
      assessmentId: assessments.id,
      studentId: assessments.studentId,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      studentRef: students.referenceNumber,
      balance: assessments.balance,
      gradeLevelName: gradeLevels.name,
      sectionName: sections.name,
    })
    .from(assessments)
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(
      and(
        ...conditions,
        // Exclude assessments that already have invoices (using NOT EXISTS for efficiency)
        notExists(
          db
            .select({ one: sql`1` })
            .from(invoices)
            .where(eq(invoices.assessmentId, assessments.id))
        )
      )
    )
    .orderBy(students.lastName, students.firstName);

  return rows.map((row) => ({
    assessmentId: row.assessmentId,
    studentId: row.studentId,
    studentName: formatStudentName(row),
    studentRef: row.studentRef,
    balance: row.balance,
    gradeLevelName: row.gradeLevelName,
    sectionName: row.sectionName,
  }));
}

/**
 * Get count of eligible assessments for preview.
 */
export async function getBatchInvoiceCandidateCount(
  params: BatchGenerateInvoicesInput
): Promise<number> {
  const { gradeLevelId, sectionId, schoolYearId } = params;

  // Build dynamic conditions
  const conditions = [
    eq(enrollments.gradeLevelId, gradeLevelId),
    isNull(assessments.cancelledAt),
    isNull(assessments.transferredAt),
    gt(assessments.balance, "0"),
    isNull(students.deletedAt),
    ne(enrollments.status, "cancelled"),
  ];

  if (sectionId) {
    conditions.push(eq(enrollments.sectionId, sectionId));
  }

  if (schoolYearId) {
    conditions.push(eq(enrollments.schoolYearId, schoolYearId));
  }

  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(assessments)
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(students, eq(assessments.studentId, students.id))
    .where(
      and(
        ...conditions,
        notExists(
          db
            .select({ one: sql`1` })
            .from(invoices)
            .where(eq(invoices.assessmentId, assessments.id))
        )
      )
    );

  return result?.count ?? 0;
}

/**
 * Get sections for a specific grade level in the active school year.
 * Used for the section dropdown in batch invoice form.
 */
export async function getSectionsForGradeLevel(
  gradeLevelId: string,
  schoolYearId?: string
): Promise<Array<{ id: string; name: string }>> {
  const conditions = [
    eq(sections.gradeLevelId, gradeLevelId),
    isNull(sections.deletedAt),
  ];

  if (schoolYearId) {
    conditions.push(eq(sections.schoolYearId, schoolYearId));
  }

  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
    })
    .from(sections)
    .where(and(...conditions))
    .orderBy(sections.name);

  return rows;
}

// ─── Batch Invoice Sending ────────────────────────────────────────────────────

export type BatchSendInvoiceCandidate = {
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  studentRef: string;
  amountDue: string;
  status: string;
  guardianEmail: string | null;
  guardianName: string | null;
  gradeLevelName: string;
  sectionName: string | null;
};

export type BatchSendFilterParams = {
  schoolYearId?: string;
  gradeLevelId?: string;
  sectionId?: string;
};

/**
 * Get invoices eligible for batch sending.
 * Returns invoices with status 'draft' or 'sent' (can be resent).
 * Includes primary guardian email if available.
 * Can filter by school year, grade level, and section.
 */
export async function getInvoicesForBatchSending(
  params: BatchSendFilterParams = {}
): Promise<BatchSendInvoiceCandidate[]> {
  const { schoolYearId, gradeLevelId, sectionId } = params;

  // Subquery to get primary guardian for each student
  const primaryGuardianSubquery = db
    .select({
      studentId: studentGuardianLinks.studentId,
      guardianId: studentGuardianLinks.guardianId,
    })
    .from(studentGuardianLinks)
    .where(
      and(
        eq(studentGuardianLinks.isPrimary, true),
        isNull(studentGuardianLinks.deletedAt)
      )
    )
    .as("primary_guardian");

  // Build conditions
  const conditions = [
    or(eq(invoices.status, "draft"), eq(invoices.status, "sent")),
    isNull(students.deletedAt),
  ];

  // Add optional filters
  if (schoolYearId) {
    conditions.push(eq(enrollments.schoolYearId, schoolYearId));
  }
  if (gradeLevelId) {
    conditions.push(eq(enrollments.gradeLevelId, gradeLevelId));
  }
  if (sectionId) {
    conditions.push(eq(enrollments.sectionId, sectionId));
  }

  const rows = await db
    .select({
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      studentId: invoices.studentId,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      studentRef: students.referenceNumber,
      amountDue: invoices.amountDue,
      status: invoices.status,
      guardianEmail: parentsGuardians.email,
      guardianFirstName: parentsGuardians.firstName,
      guardianLastName: parentsGuardians.lastName,
      gradeLevelName: gradeLevels.name,
      sectionName: sections.name,
    })
    .from(invoices)
    .innerJoin(students, eq(invoices.studentId, students.id))
    .innerJoin(assessments, eq(invoices.assessmentId, assessments.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .leftJoin(primaryGuardianSubquery, eq(students.id, primaryGuardianSubquery.studentId))
    .leftJoin(parentsGuardians, eq(primaryGuardianSubquery.guardianId, parentsGuardians.id))
    .where(and(...conditions))
    .orderBy(gradeLevels.order, students.lastName, students.firstName);

  return rows.map((row) => ({
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    studentId: row.studentId,
    studentName: formatStudentName(row),
    studentRef: row.studentRef,
    amountDue: row.amountDue,
    status: row.status,
    guardianEmail: row.guardianEmail,
    guardianName: row.guardianFirstName && row.guardianLastName
      ? `${row.guardianFirstName} ${row.guardianLastName}`
      : null,
    gradeLevelName: row.gradeLevelName,
    sectionName: row.sectionName,
  }));
}

/**
 * Get invoice details for sending (by IDs).
 * Returns invoice data needed for email generation and idempotency checking.
 */
export async function getInvoicesForSending(
  invoiceIds: string[]
): Promise<Array<{
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  studentRef: string;
  amountDue: string;
  guardianEmail: string | null;
  lastSentAt: Date | null;
}>> {
  if (invoiceIds.length === 0) return [];

  // Subquery to get primary guardian for each student
  const primaryGuardianSubquery = db
    .select({
      studentId: studentGuardianLinks.studentId,
      guardianId: studentGuardianLinks.guardianId,
    })
    .from(studentGuardianLinks)
    .where(
      and(
        eq(studentGuardianLinks.isPrimary, true),
        isNull(studentGuardianLinks.deletedAt)
      )
    )
    .as("primary_guardian");

  const rows = await db
    .select({
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      studentId: invoices.studentId,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      studentRef: students.referenceNumber,
      amountDue: invoices.amountDue,
      guardianEmail: parentsGuardians.email,
      lastSentAt: invoices.lastSentAt,
    })
    .from(invoices)
    .innerJoin(students, eq(invoices.studentId, students.id))
    .leftJoin(primaryGuardianSubquery, eq(students.id, primaryGuardianSubquery.studentId))
    .leftJoin(parentsGuardians, eq(primaryGuardianSubquery.guardianId, parentsGuardians.id))
    .where(inArray(invoices.id, invoiceIds));

  return rows.map((row) => ({
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    studentId: row.studentId,
    studentName: formatStudentName(row),
    studentRef: row.studentRef,
    amountDue: row.amountDue,
    guardianEmail: row.guardianEmail,
    lastSentAt: row.lastSentAt,
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStudentName(row: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}): string {
  const parts = [row.lastName, row.firstName];
  if (row.middleName) {
    parts.push(row.middleName.charAt(0) + ".");
  }
  if (row.suffix) {
    parts.push(row.suffix);
  }
  return parts.join(", ");
}
