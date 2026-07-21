import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { schoolYears, gradingPeriodSystems } from "@/lib/db/schema";
import { desc, isNull, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils/date";
import { GRADING_SYSTEM_LABELS, type GradingSystemType } from "@/lib/constants/grading-systems";

export const metadata: Metadata = {
  title: "School Years",
  description: "Manage school years in SRAMS.",
};

export default async function StaffSchoolYearsPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "school_years:manage")) redirect("/staff/dashboard");

  // Fetch school years
  const schoolYearRows = await db
    .select({
      id: schoolYears.id,
      label: schoolYears.label,
      startDate: schoolYears.startDate,
      endDate: schoolYears.endDate,
      isActive: schoolYears.isActive,
      createdAt: schoolYears.createdAt,
    })
    .from(schoolYears)
    .where(isNull(schoolYears.deletedAt))
    .orderBy(desc(schoolYears.startDate));

  // Fetch grading system types separately (handles case where table doesn't exist yet)
  let gradingSystemMap = new Map<string, GradingSystemType>();
  try {
    const gradingSystems = await db
      .select({
        schoolYearId: gradingPeriodSystems.schoolYearId,
        systemType: gradingPeriodSystems.systemType,
      })
      .from(gradingPeriodSystems);

    gradingSystemMap = new Map(
      gradingSystems.map((gs) => [gs.schoolYearId, gs.systemType as GradingSystemType])
    );
  } catch {
    // Table may not exist yet - migrations not applied
  }

  // Combine the data
  const rows = schoolYearRows.map((sy) => ({
    ...sy,
    gradingSystemType: gradingSystemMap.get(sy.id) ?? null,
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">School Years</h1>
          <p className="page-subtitle">
            {rows.length.toLocaleString()} school year{rows.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Link href="/staff/school-years/new" className="btn-primary" id="create-school-year-btn">
          + Create School Year
        </Link>
      </div>

      <div className="table-wrapper">
        <table className="data-table" id="school-years-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Grading System</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  No school years configured yet.
                </td>
              </tr>
            ) : (
              rows.map((sy) => (
                <tr key={sy.id} className="table-row-hover">
                  <td>
                    <strong>{sy.label}</strong>
                    {sy.isActive && <span className="badge badge-success ml-2">Active</span>}
                  </td>
                  <td>
                    {formatDate(sy.startDate, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    {formatDate(sy.endDate, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    <span className="text-sm">
                      {GRADING_SYSTEM_LABELS[sy.gradingSystemType ?? "quarterly"]}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${sy.isActive ? "badge-success" : "badge-warning"}`}>
                      {sy.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-muted">
                    {formatDate(sy.createdAt, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    <Link
                      href={`/staff/school-years/${sy.id}/edit`}
                      className="table-action-link"
                      id={`edit-school-year-${sy.id}`}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
