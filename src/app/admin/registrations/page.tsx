import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { registrations, students, schoolYears, gradeLevels, enrollments } from "@/lib/db/schema";
import { and, eq, desc, ne, notExists, sql, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import RegistrationsTable from "@/components/registrations/RegistrationsTable";
import { parseUuidSearchParam } from "@/lib/utils/query-params";

export const metadata: Metadata = {
  title: "Registrations",
  description: "View all student registrations.",
};

interface PageProps {
  searchParams: Promise<{ page?: string; schoolYearId?: string }>;
}

const PAGE_SIZE = 20;

function registrationsListHref(opts: { schoolYearId?: string; page?: number }) {
  const p = new URLSearchParams();
  if (opts.schoolYearId) p.set("schoolYearId", opts.schoolYearId);
  if (opts.page != null && opts.page > 1) p.set("page", String(opts.page));
  const s = p.toString();
  return s ? `/admin/registrations?${s}` : "/admin/registrations";
}

export default async function RegistrationsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "registrations:read")) redirect("/admin/dashboard");

  const { page = "1", schoolYearId: schoolYearIdRaw } = await searchParams;
  const schoolYearId = parseUuidSearchParam(schoolYearIdRaw);

  const parsed = parseInt(page, 10);
  const currentPage = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const activeSyRows = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);
  const activeSchoolYearId = activeSyRows[0]?.id ?? null;

  /** Omit registrations for students who already have any active enrollment in the current school year. */
  const notEnrolledInActiveYear =
    activeSchoolYearId != null
      ? notExists(
          db
            .select({ id: enrollments.id })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.studentId, students.id),
                eq(enrollments.schoolYearId, activeSchoolYearId),
                ne(enrollments.status, "cancelled")
              )
            )
        )
      : undefined;

  const registrationFilters = [
    eq(registrations.status, "approved"),
    ...(schoolYearId != null ? [eq(registrations.schoolYearId, schoolYearId)] : []),
    ...(notEnrolledInActiveYear != null ? [notEnrolledInActiveYear] : []),
  ];

  const baseRowsQuery = db
    .select({
      id: registrations.id,
      createdAt: registrations.createdAt,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      referenceNumber: students.referenceNumber,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
      studentType: registrations.studentType,
      intakeDocuments: registrations.intakeDocuments,
    })
    .from(registrations)
    .innerJoin(students, eq(registrations.studentId, students.id))
    .innerJoin(schoolYears, eq(registrations.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(registrations.gradeLevelId, gradeLevels.id))
    .$dynamic();

  const filteredRowsBase = baseRowsQuery.where(and(...registrationFilters));

  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(registrations)
    .innerJoin(students, eq(registrations.studentId, students.id))
    .where(and(...registrationFilters));

  const [schoolYearOptions, rows, countResult] = await Promise.all([
    db
      .select({ id: schoolYears.id, label: schoolYears.label })
      .from(schoolYears)
      .where(isNull(schoolYears.deletedAt))
      .orderBy(desc(schoolYears.startDate)),
    filteredRowsBase
      .orderBy(desc(registrations.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    countQuery,
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const tableData = rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: `${r.lastName}, ${r.firstName}`,
    referenceNumber: r.referenceNumber,
    schoolYear: r.schoolYear,
    gradeLevel: r.gradeLevel,
    studentType: r.studentType,
    intakeDocuments: r.intakeDocuments,
    createdAt: r.createdAt,
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Registrations</h1>
          <p className="page-subtitle">
            <strong>Approved</strong> registrations only. Learners who already have a non-cancelled
            enrollment for the <strong>active</strong> school year are omitted so you can focus on
            applicants who still need a current-year enrollment. Optional school-year filter narrows
            the school year stored on each registration.{" "}
            {totalCount.toLocaleString()} registration{totalCount !== 1 ? "s" : ""}{" "}
            {schoolYearId != null ? "matching the current filters." : "shown."}
          </p>
        </div>
        {hasPermission(session.role, "students:create") && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/students/new" className="btn-primary" id="new-registration-btn">
              + New student
            </Link>
            <Link
              href="/admin/students/new?intent=transferee"
              className="btn-secondary"
              id="new-registration-transferee-btn"
            >
              + Transferee
            </Link>
          </div>
        )}
      </div>

      <form
        method="GET"
        className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-sm)]"
      >
        <label htmlFor="registrations-school-year" className="text-sm text-[var(--color-text-muted)]">
          School year
        </label>
        <select
          id="registrations-school-year"
          name="schoolYearId"
          defaultValue={schoolYearId ?? ""}
          className="min-w-[12rem] rounded-md border border-[var(--color-border-2)] bg-[var(--color-surface)] px-3 py-2 text-[0.825rem] text-[var(--color-text)] outline-none"
        >
          <option value="">All school years</option>
          {schoolYearOptions.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Apply
        </button>
        {schoolYearId != null && (
          <Link href="/admin/registrations" className="btn-ghost text-sm">
            Clear filter
          </Link>
        )}
      </form>

      <RegistrationsTable
        registrations={tableData}
        emptyMessage={
          schoolYearId != null
            ? "No approved registrations for the selected school year that still need a current-year enrollment."
            : "No approved registrations pending current-year enrollment."
        }
      />

      {totalCount > 0 && (
        <nav
          className="flex items-center justify-between gap-4 px-0.5 py-2"
          aria-label="Registration list pagination"
        >
          <p className="pagination-info">
            Page{" "}
            <span className="font-medium text-[var(--color-text)]">{currentPage}</span> of{" "}
            <span className="font-medium text-[var(--color-text)]">{Math.max(totalPages, 1)}</span>
            <span className="ml-2">
              — {totalCount.toLocaleString()} registration{totalCount !== 1 ? "s" : ""}
            </span>
          </p>

          <div className="flex items-center gap-2">
            <Link
              href={registrationsListHref({
                schoolYearId,
                page: currentPage > 2 ? currentPage - 1 : undefined,
              })}
              aria-disabled={currentPage <= 1}
              className={`pagination-btn ${currentPage <= 1 ? "pagination-btn-disabled" : ""}`}
            >
              ← Previous
            </Link>
            <Link
              href={registrationsListHref({
                schoolYearId,
                page: currentPage + 1,
              })}
              aria-disabled={currentPage >= totalPages}
              className={`pagination-btn ${currentPage >= totalPages ? "pagination-btn-disabled" : ""}`}
            >
              Next →
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
