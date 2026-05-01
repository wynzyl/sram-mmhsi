import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";
import { desc, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "School Years",
  description: "Manage school years in SRAMS.",
};

export default async function SchoolYearsPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "school_years:manage")) redirect("/admin/dashboard");

  // Fetch all school years (not deleted)
  const rows = await db
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

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">School Years</h1>
          <p className="page-subtitle">
            {rows.length.toLocaleString()} school year{rows.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Link href="/admin/school-years/new" className="btn-primary" id="create-school-year-btn">
          + Create School Year
        </Link>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table" id="school-years-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  No school years configured yet.
                </td>
              </tr>
            ) : (
              rows.map((sy) => (
                <tr key={sy.id} className="table-row-hover">
                  <td>
                    <strong>{sy.label}</strong>
                    {sy.isActive && (
                      <span className="badge badge-success ml-2">Active</span>
                    )}
                  </td>
                  <td>
                    {new Date(sy.startDate).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    {new Date(sy.endDate).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    <span className={`badge ${sy.isActive ? "badge-success" : "badge-warning"}`}>
                      {sy.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-muted">
                    {new Date(sy.createdAt).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    <Link
                      href={`/admin/school-years/${sy.id}/edit`}
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
