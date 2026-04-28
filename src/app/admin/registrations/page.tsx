import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { registrations, students, schoolYears, gradeLevels } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import RegistrationsTable from "@/components/registrations/RegistrationsTable";

export const metadata: Metadata = {
  title: "Registrations",
  description: "Review and manage student registration requests.",
};

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function RegistrationsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "registrations:read")) redirect("/admin/dashboard");

  const { status = "pending" } = await searchParams;
  const validStatuses = ["pending", "approved", "rejected", "all"];
  const filterStatus = validStatuses.includes(status) ? status : "pending";
  const canReview = hasPermission(session.role, "registrations:review");

  const whereClause =
    filterStatus === "all"
      ? undefined
      : eq(
          registrations.status,
          filterStatus as "pending" | "approved" | "rejected"
        );

  const rows = await db
    .select({
      id: registrations.id,
      status: registrations.status,
      createdAt: registrations.createdAt,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      referenceNumber: students.referenceNumber,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
    })
    .from(registrations)
    .innerJoin(students, eq(registrations.studentId, students.id))
    .innerJoin(schoolYears, eq(registrations.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(registrations.gradeLevelId, gradeLevels.id))
    .where(whereClause)
    .orderBy(desc(registrations.createdAt))
    .limit(100);

  const tableData = rows.map((r) => ({
    id: r.id,
    studentName: `${r.lastName}, ${r.firstName}`,
    referenceNumber: r.referenceNumber,
    schoolYear: r.schoolYear,
    gradeLevel: r.gradeLevel,
    status: r.status,
    createdAt: r.createdAt,
  }));

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Registrations
            {pendingCount > 0 && filterStatus === "pending" && (
              <span className="badge badge-warning ml-2">{pendingCount} Pending</span>
            )}
          </h1>
          <p className="page-subtitle">Review and manage student registration requests.</p>
        </div>
        {hasPermission(session.role, "students:create") && (
          <Link href="/admin/students/new" className="btn-primary" id="new-registration-btn">
            + Register Student
          </Link>
        )}
      </div>

      {/* Status Filter Tabs */}
      <nav className="tab-nav" aria-label="Filter registrations by status">
        {["pending", "approved", "rejected", "all"].map((s) => (
          <Link
            key={s}
            href={`/admin/registrations?status=${s}`}
            className={`tab-link ${filterStatus === s ? "tab-link-active" : ""}`}
            id={`filter-${s}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </nav>

      <RegistrationsTable registrations={tableData} canReview={canReview} />
    </div>
  );
}
