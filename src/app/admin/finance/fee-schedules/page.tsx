import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { feeSchedules, schoolYears, gradeLevels, feeScheduleItems } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import FeeSchedulesTable from "@/components/finance/FeeSchedulesTable";

export const metadata: Metadata = {
  title: "Fee Schedules",
  description: "Manage standard billing catalogs per school year.",
};

export default async function FeeSchedulesPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    redirect("/admin/dashboard");
  }

  const rows = await db
    .select({
      id: feeSchedules.id,
      description: feeSchedules.description,
      isActive: feeSchedules.isActive,
      schoolYear: schoolYears.label,
      gradeLevelName: gradeLevels.name,
      createdAt: feeSchedules.createdAt,
    })
    .from(feeSchedules)
    .innerJoin(schoolYears, eq(feeSchedules.schoolYearId, schoolYears.id))
    .leftJoin(gradeLevels, eq(feeSchedules.gradeLevelId, gradeLevels.id))
    .orderBy(desc(feeSchedules.createdAt));

  const itemsSummary = await db
    .select({
      feeScheduleId: feeScheduleItems.feeScheduleId,
      count: sql<number>`count(*)`,
      total: sql<number>`sum(case when ${feeScheduleItems.isDiscount} = false then ${feeScheduleItems.amount} else -${feeScheduleItems.amount} end)`,
    })
    .from(feeScheduleItems)
    .groupBy(feeScheduleItems.feeScheduleId);

  const summaryMap = Object.fromEntries(
    itemsSummary.map((s) => [s.feeScheduleId, { count: s.count, total: s.total }])
  );

  const tableData = rows.map((r) => ({
    id: r.id,
    schoolYear: r.schoolYear,
    scopeLabel: r.gradeLevelName ?? "All grade levels",
    description: r.description,
    isActive: r.isActive,
    itemCount: Number(summaryMap[r.id]?.count || 0),
    totalAmount: Number(summaryMap[r.id]?.total || 0),
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Schedules</h1>
          <p className="page-subtitle">
            One standard catalog per school year, shared by all grade levels. Edit line items on the
            detail page.
          </p>
        </div>
        <Link href="/admin/finance/fee-schedules/new" className="btn-primary">
          + New Schedule
        </Link>
      </div>

      <FeeSchedulesTable schedules={tableData} />
    </div>
  );
}
