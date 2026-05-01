import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  enrollments,
  students,
  schoolYears,
  gradeLevels,
  sections,
  assessments,
} from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import EnrollmentsTable from "@/components/enrollments/EnrollmentsTable";

export const metadata: Metadata = {
  title: "Enrollments",
  description: "Manage student enrollments in SRAMS.",
};

interface PageProps {
  searchParams: Promise<{ status?: string; sy?: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "badge-warning",
  assessed: "badge-secondary",
  enrolled: "badge-success",
  cancelled: "badge-danger",
};

export default async function EnrollmentsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "enrollments:read")) redirect("/admin/dashboard");

  const { status = "all", sy = "" } = await searchParams;
  const validStatuses = ["pending", "assessed", "enrolled", "cancelled", "all"];
  const filterStatus = validStatuses.includes(status) ? status : "all";
  const canCreate = hasPermission(session.role, "enrollments:create");
  const canCancel = hasPermission(session.role, "enrollments:cancel");
  const canOverrideEnrolled = hasPermission(session.role, "enrollments:override_enroll");

  // Build where clause
  const statusFilter =
    filterStatus !== "all"
      ? eq(
          enrollments.status,
          filterStatus as "pending" | "assessed" | "enrolled" | "cancelled"
        )
      : undefined;

  const rows = await db
    .select({
      id: enrollments.id,
      status: enrollments.status,
      enrolledAt: enrollments.enrolledAt,
      cancelledAt: enrollments.cancelledAt,
      createdAt: enrollments.createdAt,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      referenceNumber: students.referenceNumber,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
      section: sections.name,
      assessmentId: assessments.id,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .leftJoin(assessments, eq(assessments.enrollmentId, enrollments.id))
    .where(statusFilter)
    .orderBy(desc(enrollments.createdAt))
    .limit(100);

  // Count by status
  const counts = await db
    .select({ status: enrollments.status, count: sql<number>`count(*)` })
    .from(enrollments)
    .groupBy(enrollments.status);

  const countMap = Object.fromEntries(counts.map((c) => [c.status, c.count]));
  const totalActive = (countMap["pending"] ?? 0) + (countMap["assessed"] ?? 0);

  const tableData = rows.map((r) => ({
    id: r.id,
    status: r.status,
    studentName: `${r.lastName}, ${r.firstName}`,
    referenceNumber: r.referenceNumber,
    studentId: r.studentId,
    schoolYear: r.schoolYear,
    gradeLevel: r.gradeLevel,
    section: r.section ?? null,
    enrolledAt: r.enrolledAt,
    createdAt: r.createdAt,
    assessmentId: r.assessmentId ?? null,
  }));

  const allSections = await db
    .select({ id: sections.id, name: sections.name })
    .from(sections);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Enrollments
            {totalActive > 0 && (
              <span className="badge badge-warning ml-2">{totalActive} Active</span>
            )}
          </h1>
          <p className="page-subtitle">
            {Object.values(countMap).reduce((a, b) => a + b, 0)} total enrollments
          </p>
        </div>
        {canCreate && (
          <Link href="/admin/enrollments/new" className="btn-primary" id="new-enrollment-btn">
            + Enroll Student
          </Link>
        )}
      </div>

      {/* Status Summary Chips */}
      <div className="status-chips">
        {["pending", "assessed", "enrolled", "cancelled"].map((s) => (
          <div key={s} className={`status-chip badge ${STATUS_COLORS[s]}`}>
            <span className="text-capitalize">{s}</span>
            <strong>{countMap[s] ?? 0}</strong>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <nav className="tab-nav" aria-label="Filter enrollments by status">
        {["all", "pending", "assessed", "enrolled", "cancelled"].map((s) => (
          <Link
            key={s}
            href={`/admin/enrollments?status=${s}`}
            className={`tab-link ${filterStatus === s ? "tab-link-active" : ""}`}
            id={`filter-${s}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && countMap[s] ? ` (${countMap[s]})` : ""}
          </Link>
        ))}
      </nav>

      <EnrollmentsTable
        enrollments={tableData}
        sections={allSections}
        canManage={canCreate}
        canCancel={canCancel}
        canOverrideEnrolled={canOverrideEnrolled}
      />
    </div>
  );
}
