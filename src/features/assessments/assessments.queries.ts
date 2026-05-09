import 'server-only';
import "server-only";

import { db } from "@/lib/db";
import { assessments, students, schoolYears } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import {
  type PaginationParams,
  type PaginatedResult,
  calculatePagination,
  calculateOffset,
} from "@/lib/types/pagination";

export type AssessmentListItem = {
  id: string;
  studentName: string;
  schoolYear: string;
  totalAmount: number;
  totalPaid: number;
  balance: number;
  billingStatus: "outstanding" | "fully_paid" | "cancelled";
};

/**
 * Get paginated assessments list.
 * Default page size: 25 records per page.
 */
export async function getAssessmentsList(
  params: PaginationParams = { page: 1, pageSize: 25 }
): Promise<PaginatedResult<AssessmentListItem>> {
  const { page, pageSize } = params;
  const offset = calculateOffset(page, pageSize);

  // Get total count for pagination metadata
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(assessments);

  const totalRecords = Number(countResult?.count ?? 0);

  // Get paginated data
  const rows = await db
    .select({
      id: assessments.id,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
      studentLastName: students.lastName,
      studentFirstName: students.firstName,
      schoolYear: schoolYears.label,
    })
    .from(assessments)
    .innerJoin(students, eq(assessments.studentId, students.id))
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .orderBy(desc(assessments.createdAt))
    .limit(pageSize)
    .offset(offset);

  const data = rows.map(
    (r): AssessmentListItem => ({
      id: r.id,
      studentName: `${r.studentLastName}, ${r.studentFirstName}`,
      schoolYear: r.schoolYear,
      totalAmount: Number(r.totalAmount),
      totalPaid: Number(r.totalPaid),
      balance: Number(r.balance),
      billingStatus: r.billingStatus,
    })
  );

  return {
    data,
    pagination: calculatePagination(page, pageSize, totalRecords),
  };
}
