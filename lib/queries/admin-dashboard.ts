import "server-only";

import { and, desc, eq, gt, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
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

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const [activeSchoolYear] = await db
    .select({
      id: schoolYears.id,
      label: schoolYears.label,
      startDate: schoolYears.startDate,
    })
    .from(schoolYears)
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);

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

  const [previousSchoolYear] = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(
      and(
        isNull(schoolYears.deletedAt),
        eq(schoolYears.isActive, false),
        lt(schoolYears.startDate, activeSchoolYear.startDate)
      )
    )
    .orderBy(desc(schoolYears.startDate))
    .limit(1);

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
      .where(
        and(
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
      .where(
        and(
          eq(assessments.schoolYearId, activeSchoolYear.id),
          ne(assessments.billingStatus, "cancelled"),
          gt(assessments.balance, "0")
        )
      )
      .then((rows) => rows[0]),
    db
      .select({
        count: sql<number>`COUNT(DISTINCT ${assessments.studentId})`,
        amount: sql<string>`COALESCE(SUM(${assessments.balance}::numeric), 0)`,
      })
      .from(assessments)
      .where(
        and(
          eq(assessments.schoolYearId, activeSchoolYear.id),
          ne(assessments.billingStatus, "cancelled"),
          gt(assessments.balance, "0"),
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
