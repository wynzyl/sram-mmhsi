import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { schoolYears, gradingPeriodSystems } from "@/lib/db/schema";
import { desc, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils/date";
import { GRADING_SYSTEM_LABELS, type GradingSystemType } from "@/lib/constants/grading-systems";
import { isUndefinedTableError } from "@/lib/utils/pg-error";
import { logger } from "@/lib/observability/logger";

export const metadata: Metadata = {
  title: "School Years",
  description: "Manage school years in SRAMS.",
};

export default async function StaffSchoolYearsPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "school_years:manage")) redirect("/staff/dashboard");

  // Fetch school years and grading-system types concurrently. The grading-system
  // query is defensive: if the table doesn't exist yet (migrations not applied) it
  // falls back to an empty map without failing the page. Unexpected DB failures are
  // logged so they don't hide behind the empty-map fallback.
  const [schoolYearRows, gradingSystemMap] = await Promise.all([
    db
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
      .orderBy(desc(schoolYears.startDate)),
    (async (): Promise<Map<string, GradingSystemType>> => {
      try {
        const gradingSystems = await db
          .select({
            schoolYearId: gradingPeriodSystems.schoolYearId,
            systemType: gradingPeriodSystems.systemType,
          })
          .from(gradingPeriodSystems);

        return new Map(
          gradingSystems.map((gs) => [gs.schoolYearId, gs.systemType as GradingSystemType])
        );
      } catch (error) {
        if (!isUndefinedTableError(error)) {
          logger.error("[school-years] Failed to load grading system types", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return new Map<string, GradingSystemType>();
      }
    })(),
  ]);

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
