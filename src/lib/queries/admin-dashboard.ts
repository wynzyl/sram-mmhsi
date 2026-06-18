import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { and, desc, eq, gt, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import {
  assessments,
  enrollments,
  invoices,
  payments,
  registrations,
  schoolYears,
} from "@/lib/db/schema";

export type AdminDashboardMetrics = {
  activeSchoolYear: {
    id: string;
    label: string;
  } | null;
  totalEnrolled: number;
  previousYearEnrolled: number;
  enrollmentDelta: number;
  approvedRegistrations: number;
  enrollmentConversionRate: number;
  totalCollectedMtd: number;
  collectionRate: number;
  outstandingReceivables: number;
  overdueAccountsCount: number;
  overdueAccountsAmount: number;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

/**
 * Get admin dashboard metrics with caching.
 * Cache is revalidated every 60 seconds to ensure financial data freshness.
 * Cache can be manually invalidated using invalidateTag(CACHE_TAGS.DASHBOARD)
 * from actions that materially change KPIs (payment post/void, enrollment
 * confirmation, assessment creation, school year changes).
 */
export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  "use cache";
  cacheTag(CACHE_TAGS.DASHBOARD);
  cacheLife("minutes"); // 1 min revalidate (close to 60s)
  // Parallelize school year queries (optimization: avoid waterfall)
  const schoolYearsData = await db
    .select({
      id: schoolYears.id,
      label: schoolYears.label,
      startDate: schoolYears.startDate,
      isActive: schoolYears.isActive,
    })
    .from(schoolYears)
    .where(isNull(schoolYears.deletedAt))
    .orderBy(desc(schoolYears.startDate))
    .limit(2); // Get active + previous in one query

  const activeSchoolYear = schoolYearsData.find((sy) => sy.isActive);
  const previousSchoolYear = schoolYearsData.find((sy) => !sy.isActive);

  if (!activeSchoolYear) {
    return {
      activeSchoolYear: null,
      totalEnrolled: 0,
      previousYearEnrolled: 0,
      enrollmentDelta: 0,
      approvedRegistrations: 0,
      enrollmentConversionRate: 0,
      totalCollectedMtd: 0,
      collectionRate: 0,
      outstandingReceivables: 0,
      overdueAccountsCount: 0,
      overdueAccountsAmount: 0,
    };
  }

  const [totalEnrolledRow, approvedRegistrationsRow] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.schoolYearId, activeSchoolYear.id),
          eq(enrollments.status, "enrolled")
        )
      )
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(registrations)
      .where(
        and(
          eq(registrations.schoolYearId, activeSchoolYear.id),
          eq(registrations.status, "approved")
        )
      )
      .then((rows) => rows[0]),
  ]);

  const previousYearEnrolled = previousSchoolYear
    ? await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.schoolYearId, previousSchoolYear.id),
            eq(enrollments.status, "enrolled")
          )
        )
        .then((rows) => toNumber(rows[0]?.count))
    : 0;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

  const [totalCollectedMtdRow, assessedTotalRow, outstandingArRow, overdueRow] = await Promise.all([
    db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
      })
      .from(payments)
      .innerJoin(assessments, eq(payments.assessmentId, assessments.id))
      .where(
        and(
          eq(payments.status, "posted"),
          eq(assessments.schoolYearId, activeSchoolYear.id),
          gte(payments.paymentDate, monthStart),
          lt(payments.paymentDate, nextMonthStart)
        )
      )
      .then((rows) => rows[0]),
    db
      .select({
        total: sql<string>`COALESCE(SUM(${assessments.totalAmount}::numeric), 0)`,
      })
      .from(assessments)
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .where(
        and(
          eq(enrollments.status, "enrolled"),
          eq(assessments.schoolYearId, activeSchoolYear.id),
          ne(assessments.billingStatus, "cancelled")
        )
      )
      .then((rows) => rows[0]),
    db
      .select({
        total: sql<string>`COALESCE(SUM(${assessments.balance}::numeric), 0)`,
      })
      .from(assessments)
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .where(
        and(
          eq(enrollments.status, "enrolled"),
          eq(assessments.schoolYearId, activeSchoolYear.id),
          eq(assessments.billingStatus, "outstanding"), // Only outstanding (excludes assessed students)
          gt(assessments.balance, "0"),
          isNull(assessments.transferredAt) // Exclude transferred balances
        )
      )
      .then((rows) => rows[0]),
    db
      .select({
        count: sql<number>`COUNT(DISTINCT ${assessments.studentId})`,
        amount: sql<string>`COALESCE(SUM(${assessments.balance}::numeric), 0)`,
      })
      .from(assessments)
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .where(
        and(
          eq(enrollments.status, "enrolled"),
          eq(assessments.schoolYearId, activeSchoolYear.id),
          eq(assessments.billingStatus, "outstanding"), // Only outstanding (excludes assessed students)
          gt(assessments.balance, "0"),
          isNull(assessments.transferredAt), // Exclude transferred balances
          sql`EXISTS (
            SELECT 1
            FROM ${invoices}
            WHERE ${invoices.assessmentId} = ${assessments.id}
              AND ${invoices.dueDate} IS NOT NULL
              AND ${invoices.dueDate} < NOW()
              AND ${invoices.status} != 'settled'
          )`
        )
      )
      .then((rows) => rows[0]),
  ]);

  const totalEnrolled = toNumber(totalEnrolledRow?.count);
  const approvedRegistrations = toNumber(approvedRegistrationsRow?.count);
  const totalCollectedMtd = toNumber(totalCollectedMtdRow?.total);
  const assessedTotal = toNumber(assessedTotalRow?.total);
  const outstandingReceivables = toNumber(outstandingArRow?.total);
  const overdueAccountsCount = toNumber(overdueRow?.count);
  const overdueAccountsAmount = toNumber(overdueRow?.amount);

  const enrollmentConversionRate =
    approvedRegistrations > 0 ? totalEnrolled / approvedRegistrations : 0;
  const collectionRate = assessedTotal > 0 ? totalCollectedMtd / assessedTotal : 0;

  return {
    activeSchoolYear: {
      id: activeSchoolYear.id,
      label: activeSchoolYear.label,
    },
    totalEnrolled,
    previousYearEnrolled,
    enrollmentDelta: totalEnrolled - previousYearEnrolled,
    approvedRegistrations,
    enrollmentConversionRate,
    totalCollectedMtd,
    collectionRate,
    outstandingReceivables,
    overdueAccountsCount,
    overdueAccountsAmount,
  };
}
