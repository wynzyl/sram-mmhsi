import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { feeSchedules, schoolYears, gradeLevels, feeScheduleItems } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import FeeScheduleItemsList from "@/components/finance/FeeScheduleItemsList";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Fee Schedule Details",
};

export default async function FeeScheduleDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    redirect("/admin/dashboard");
  }

  const schedule = await db
    .select({
      id: feeSchedules.id,
      description: feeSchedules.description,
      isActive: feeSchedules.isActive,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
    })
    .from(feeSchedules)
    .innerJoin(schoolYears, eq(feeSchedules.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(feeSchedules.gradeLevelId, gradeLevels.id))
    .where(eq(feeSchedules.id, id))
    .limit(1)
    .then((res) => res[0]);

  if (!schedule) notFound();

  const items = await db
    .select()
    .from(feeScheduleItems)
    .where(eq(feeScheduleItems.feeScheduleId, id))
    .orderBy(asc(feeScheduleItems.order), asc(feeScheduleItems.createdAt));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {schedule.gradeLevel} - {schedule.schoolYear}
          </h1>
          <p className="page-subtitle">
            {schedule.description || "No description provided."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Details</h2>
            </div>
            <div className="card-body">
              <p><strong>School Year:</strong> {schedule.schoolYear}</p>
              <p><strong>Grade Level:</strong> {schedule.gradeLevel}</p>
              <p>
                <strong>Status:</strong>{" "}
                <span className={`badge ${schedule.isActive ? "badge-success" : "badge-secondary"}`}>
                  {schedule.isActive ? "Active" : "Inactive"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <FeeScheduleItemsList feeScheduleId={id} items={items} />
        </div>
      </div>
    </div>
  );
}
