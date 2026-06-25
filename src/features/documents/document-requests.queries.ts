/**
 * Document Requests Queries
 *
 * Database queries for document request management.
 */

import "server-only";
import { db } from "@/lib/db";
import {
  documentRequests,
  students,
  schoolYears,
  users,
  assessments,
} from "@/lib/db/schema";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import {
  DOCUMENT_REQUEST_STATUSES,
  DOCUMENT_REQUEST_TYPES,
  type DocumentRequestStatus,
  type DocumentRequestType,
} from "@/lib/constants/document-requests";
import type {
  DocumentRequestFilterInput,
  DocumentRequestSummary,
} from "./document-requests.schema";
import { hasPendingClearances } from "@/features/clearances/clearances.queries";

export const DOCUMENT_REQUEST_PAGE_SIZE = 20;

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentRequestListItem = {
  id: string;
  studentId: string;
  studentRef: string;
  studentName: string;
  documentType: DocumentRequestType;
  purpose: string | null;
  copies: number;
  status: DocumentRequestStatus;
  feeAmount: string | null;
  documentNumber: string | null;
  requestedAt: Date;
  requestedByName: string;
  processedAt: Date | null;
  processedByName: string | null;
  releasedAt: Date | null;
  releasedByName: string | null;
};

export type DocumentRequestDetail = DocumentRequestListItem & {
  schoolYearId: string | null;
  schoolYearLabel: string | null;
  remarks: string | null;
  rejectedReason: string | null;
  paymentId: string | null;
  createdAt: Date;
};

export type StudentDocumentSummary = {
  totalRequests: number;
  pendingRequests: number;
  releasedRequests: number;
  requests: DocumentRequestListItem[];
};

// ─── Balance & Clearance Checks ──────────────────────────────────────────────

/**
 * Get total outstanding balance for a student (across all assessments)
 */
export async function getStudentOutstandingBalance(
  studentId: string
): Promise<number> {
  const [result] = await db
    .select({
      totalBalance: sql<string>`COALESCE(SUM(${assessments.balance}), 0)`,
    })
    .from(assessments)
    .where(
      and(
        eq(assessments.studentId, studentId),
        eq(assessments.billingStatus, "outstanding"),
        isNull(assessments.cancelledAt)
      )
    );

  return Number(result?.totalBalance ?? 0);
}

/**
 * Check if a student can have documents released
 * Returns { canRelease: true } or { canRelease: false, reason: string }
 */
export async function checkDocumentReleaseEligibility(
  studentId: string
): Promise<{ canRelease: true } | { canRelease: false; reason: string }> {
  // Check outstanding balance
  const balance = await getStudentOutstandingBalance(studentId);
  if (balance > 0.01) {
    return {
      canRelease: false,
      reason: `Student has an outstanding balance of ₱${balance.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
      })}`,
    };
  }

  // Check pending clearances
  const hasPending = await hasPendingClearances(studentId);
  if (hasPending) {
    return {
      canRelease: false,
      reason: "Student has pending clearances that must be resolved first",
    };
  }

  return { canRelease: true };
}

// ─── Document Request Queries ────────────────────────────────────────────────

/**
 * Fetch paginated list of document requests
 */
export async function fetchDocumentRequestsPage(
  params: DocumentRequestFilterInput
): Promise<{
  rows: DocumentRequestListItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}> {
  const currentPage = Math.max(1, params.page);
  const pageSize = params.pageSize || DOCUMENT_REQUEST_PAGE_SIZE;
  const offset = (currentPage - 1) * pageSize;

  // Build filter conditions
  const conditions: ReturnType<typeof eq>[] = [isNull(documentRequests.deletedAt)];

  if (params.status) {
    conditions.push(eq(documentRequests.status, params.status));
  }

  if (params.documentType) {
    conditions.push(eq(documentRequests.documentType, params.documentType));
  }

  if (params.studentId) {
    conditions.push(eq(documentRequests.studentId, params.studentId));
  }

  if (params.schoolYearId) {
    conditions.push(eq(documentRequests.schoolYearId, params.schoolYearId));
  }

  if (params.search?.trim()) {
    const searchTerm = params.search.trim();
    conditions.push(
      or(
        ilike(students.firstName, `%${searchTerm}%`),
        ilike(students.lastName, `%${searchTerm}%`),
        ilike(students.referenceNumber, `%${searchTerm}%`),
        ilike(documentRequests.documentNumber, `%${searchTerm}%`)
      )!
    );
  }

  const whereClause = and(...conditions);

  // Execute count and list queries in parallel
  const [countResult, rows] = await Promise.all([
    db
      .select({ count: count() })
      .from(documentRequests)
      .innerJoin(students, eq(documentRequests.studentId, students.id))
      .where(whereClause),

    db
      .select({
        id: documentRequests.id,
        studentId: documentRequests.studentId,
        studentRef: students.referenceNumber,
        firstName: students.firstName,
        lastName: students.lastName,
        documentType: documentRequests.documentType,
        purpose: documentRequests.purpose,
        copies: documentRequests.copies,
        status: documentRequests.status,
        feeAmount: documentRequests.feeAmount,
        documentNumber: documentRequests.documentNumber,
        requestedAt: documentRequests.requestedAt,
        requestedBy: documentRequests.requestedBy,
        processedAt: documentRequests.processedAt,
        processedBy: documentRequests.processedBy,
        releasedAt: documentRequests.releasedAt,
        releasedBy: documentRequests.releasedBy,
      })
      .from(documentRequests)
      .innerJoin(students, eq(documentRequests.studentId, students.id))
      .where(whereClause)
      .orderBy(desc(documentRequests.requestedAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  // Get user names for requestedBy, processedBy, releasedBy
  const userIds = [
    ...rows.map((r) => r.requestedBy),
    ...rows.filter((r) => r.processedBy).map((r) => r.processedBy!),
    ...rows.filter((r) => r.releasedBy).map((r) => r.releasedBy!),
  ].filter(Boolean);

  const userNameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const usersData = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, userIds));

    usersData.forEach((u) => userNameMap.set(u.id, u.username));
  }

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentRef: r.studentRef,
      studentName: `${r.lastName}, ${r.firstName}`,
      documentType: r.documentType as DocumentRequestType,
      purpose: r.purpose,
      copies: r.copies,
      status: r.status as DocumentRequestStatus,
      feeAmount: r.feeAmount,
      documentNumber: r.documentNumber,
      requestedAt: r.requestedAt,
      requestedByName: userNameMap.get(r.requestedBy) ?? "Unknown",
      processedAt: r.processedAt,
      processedByName: r.processedBy
        ? (userNameMap.get(r.processedBy) ?? "Unknown")
        : null,
      releasedAt: r.releasedAt,
      releasedByName: r.releasedBy
        ? (userNameMap.get(r.releasedBy) ?? "Unknown")
        : null,
    })),
    totalCount,
    totalPages,
    currentPage,
  };
}

/**
 * Get document request by ID
 */
export async function getDocumentRequestById(
  requestId: string
): Promise<DocumentRequestDetail | null> {
  const [row] = await db
    .select({
      id: documentRequests.id,
      studentId: documentRequests.studentId,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      schoolYearId: documentRequests.schoolYearId,
      documentType: documentRequests.documentType,
      purpose: documentRequests.purpose,
      copies: documentRequests.copies,
      status: documentRequests.status,
      feeAmount: documentRequests.feeAmount,
      documentNumber: documentRequests.documentNumber,
      remarks: documentRequests.remarks,
      rejectedReason: documentRequests.rejectedReason,
      paymentId: documentRequests.paymentId,
      requestedAt: documentRequests.requestedAt,
      requestedBy: documentRequests.requestedBy,
      processedAt: documentRequests.processedAt,
      processedBy: documentRequests.processedBy,
      releasedAt: documentRequests.releasedAt,
      releasedBy: documentRequests.releasedBy,
      createdAt: documentRequests.createdAt,
    })
    .from(documentRequests)
    .innerJoin(students, eq(documentRequests.studentId, students.id))
    .where(
      and(eq(documentRequests.id, requestId), isNull(documentRequests.deletedAt))
    )
    .limit(1);

  if (!row) return null;

  // Get school year label
  let schoolYearLabel: string | null = null;
  if (row.schoolYearId) {
    const [sy] = await db
      .select({ label: schoolYears.label })
      .from(schoolYears)
      .where(eq(schoolYears.id, row.schoolYearId))
      .limit(1);
    schoolYearLabel = sy?.label ?? null;
  }

  // Get user names
  const userIds = [row.requestedBy, row.processedBy, row.releasedBy].filter(
    Boolean
  ) as string[];
  const userNameMap = new Map<string, string>();

  if (userIds.length > 0) {
    const usersData = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, userIds));

    usersData.forEach((u) => userNameMap.set(u.id, u.username));
  }

  return {
    id: row.id,
    studentId: row.studentId,
    studentRef: row.studentRef,
    studentName: `${row.lastName}, ${row.firstName}`,
    schoolYearId: row.schoolYearId,
    schoolYearLabel,
    documentType: row.documentType as DocumentRequestType,
    purpose: row.purpose,
    copies: row.copies,
    status: row.status as DocumentRequestStatus,
    feeAmount: row.feeAmount,
    documentNumber: row.documentNumber,
    remarks: row.remarks,
    rejectedReason: row.rejectedReason,
    paymentId: row.paymentId,
    requestedAt: row.requestedAt,
    requestedByName: userNameMap.get(row.requestedBy) ?? "Unknown",
    processedAt: row.processedAt,
    processedByName: row.processedBy
      ? (userNameMap.get(row.processedBy) ?? "Unknown")
      : null,
    releasedAt: row.releasedAt,
    releasedByName: row.releasedBy
      ? (userNameMap.get(row.releasedBy) ?? "Unknown")
      : null,
    createdAt: row.createdAt,
  };
}

/**
 * Get document request for validation (minimal fields)
 */
export async function getDocumentRequestForValidation(
  requestId: string
): Promise<{
  id: string;
  studentId: string;
  status: DocumentRequestStatus;
  documentType: DocumentRequestType;
} | null> {
  const [result] = await db
    .select({
      id: documentRequests.id,
      studentId: documentRequests.studentId,
      status: documentRequests.status,
      documentType: documentRequests.documentType,
    })
    .from(documentRequests)
    .where(
      and(eq(documentRequests.id, requestId), isNull(documentRequests.deletedAt))
    )
    .limit(1);

  if (!result) return null;

  return {
    ...result,
    status: result.status as DocumentRequestStatus,
    documentType: result.documentType as DocumentRequestType,
  };
}

/**
 * Get document requests summary statistics
 */
export async function getDocumentRequestsSummary(): Promise<DocumentRequestSummary> {
  // Count by status
  const statusCounts = await db
    .select({
      status: documentRequests.status,
      count: count(),
    })
    .from(documentRequests)
    .where(isNull(documentRequests.deletedAt))
    .groupBy(documentRequests.status);

  // Count by document type
  const typeCounts = await db
    .select({
      documentType: documentRequests.documentType,
      count: count(),
    })
    .from(documentRequests)
    .where(isNull(documentRequests.deletedAt))
    .groupBy(documentRequests.documentType);

  // Build by-status map
  const byStatus = {} as Record<DocumentRequestStatus, number>;
  for (const status of DOCUMENT_REQUEST_STATUSES) {
    byStatus[status] = 0;
  }
  let total = 0;
  for (const row of statusCounts) {
    byStatus[row.status as DocumentRequestStatus] = row.count;
    total += row.count;
  }

  // Build by-type map
  const byDocumentType = {} as Record<DocumentRequestType, number>;
  for (const docType of DOCUMENT_REQUEST_TYPES) {
    byDocumentType[docType] = 0;
  }
  for (const row of typeCounts) {
    byDocumentType[row.documentType as DocumentRequestType] = row.count;
  }

  return {
    total,
    byStatus,
    byDocumentType,
  };
}

/**
 * Get pending document requests count (for badge display)
 */
export async function getPendingDocumentRequestsCount(): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(documentRequests)
    .where(
      and(
        inArray(documentRequests.status, ["requested", "processing", "ready"]),
        isNull(documentRequests.deletedAt)
      )
    );

  return result?.count ?? 0;
}

/**
 * Get document requests for a student
 */
export async function getStudentDocumentRequests(
  studentId: string
): Promise<StudentDocumentSummary> {
  const result = await fetchDocumentRequestsPage({
    page: 1,
    pageSize: 100,
    studentId,
  });

  const pendingRequests = result.rows.filter(
    (r) => r.status === "requested" || r.status === "processing" || r.status === "ready"
  ).length;

  const releasedRequests = result.rows.filter((r) => r.status === "released").length;

  return {
    totalRequests: result.totalCount,
    pendingRequests,
    releasedRequests,
    requests: result.rows,
  };
}

/**
 * Get school year options for filter dropdown
 */
export async function getSchoolYearOptions(): Promise<
  Array<{ id: string; label: string }>
> {
  const options = await db
    .select({ id: schoolYears.id, label: schoolYears.label })
    .from(schoolYears)
    .where(isNull(schoolYears.deletedAt))
    .orderBy(desc(schoolYears.startDate));

  return options;
}

// ─── Document Export Data ─────────────────────────────────────────────────────

import {
  enrollments,
  gradeLevels,
  sections,
} from "@/lib/db/schema";
import type { DocumentExportData } from "./document.export";

/**
 * Get document data for PDF export
 */
export async function getDocumentExportData(
  requestId: string
): Promise<DocumentExportData | null> {
  // Get the document request with student info
  const [row] = await db
    .select({
      id: documentRequests.id,
      documentType: documentRequests.documentType,
      documentNumber: documentRequests.documentNumber,
      purpose: documentRequests.purpose,
      copies: documentRequests.copies,
      releasedAt: documentRequests.releasedAt,
      schoolYearId: documentRequests.schoolYearId,
      studentId: documentRequests.studentId,
      // Student info
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      referenceNumber: students.referenceNumber,
    })
    .from(documentRequests)
    .innerJoin(students, eq(documentRequests.studentId, students.id))
    .where(
      and(eq(documentRequests.id, requestId), isNull(documentRequests.deletedAt))
    )
    .limit(1);

  if (!row) return null;

  // Format student name
  const nameParts = [row.firstName];
  if (row.middleName) nameParts.push(row.middleName);
  nameParts.push(row.lastName);
  if (row.suffix) nameParts.push(row.suffix);
  const studentName = nameParts.join(" ");

  // Get school year label if present
  let schoolYearLabel: string | null = null;
  if (row.schoolYearId) {
    const [sy] = await db
      .select({ label: schoolYears.label })
      .from(schoolYears)
      .where(eq(schoolYears.id, row.schoolYearId))
      .limit(1);
    schoolYearLabel = sy?.label ?? null;
  }

  // Get latest enrollment for grade level and section
  let gradeLevel: string | null = null;
  let section: string | null = null;

  const [latestEnrollment] = await db
    .select({
      gradeLevelName: gradeLevels.name,
      sectionName: sections.name,
    })
    .from(enrollments)
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(
      and(
        eq(enrollments.studentId, row.studentId),
        // Enrollments use cancelledAt, not deletedAt
        isNull(enrollments.cancelledAt),
        // If we have a specific school year, filter by it
        row.schoolYearId
          ? eq(enrollments.schoolYearId, row.schoolYearId)
          : sql`TRUE`
      )
    )
    .orderBy(desc(enrollments.createdAt))
    .limit(1);

  if (latestEnrollment) {
    gradeLevel = latestEnrollment.gradeLevelName;
    section = latestEnrollment.sectionName;
  }

  return {
    requestId: row.id,
    documentType: row.documentType as DocumentRequestType,
    documentNumber: row.documentNumber,
    studentName,
    studentReferenceNumber: row.referenceNumber,
    gradeLevel,
    section,
    schoolYearLabel,
    purpose: row.purpose,
    releasedAt: row.releasedAt,
    copies: row.copies,
  };
}
