import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { enrollments, registrations, schoolYears, students } from "@/lib/db/schema";
import { and, desc, eq, exists, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { StudentsTable, type StudentRow } from "@/components/students/StudentsTable";
import { parseUuidSearchParam } from "@/lib/utils/query-params";

export const metadata: Metadata = {
  title: "Students",
  description: "Manage student records in SRAMS.",
};

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; schoolYearId?: string }>;
}

const PAGE_SIZE = 20;

function studentsListHref(opts: { q?: string; schoolYearId?: string; page?: number }) {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.schoolYearId) p.set("schoolYearId", opts.schoolYearId);
  if (opts.page != null && opts.page > 1) p.set("page", String(opts.page));
  const s = p.toString();
  return s ? `/admin/students?${s}` : "/admin/students";
}

export default async function StudentsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "students:read")) redirect("/admin/dashboard");

  const { q = "", page = "1", schoolYearId: schoolYearIdRaw } = await searchParams;
  const schoolYearId = parseUuidSearchParam(schoolYearIdRaw);

  const currentPage = Math.max(1, parseInt(page, 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const searchWhere =
    q.trim() !== ""
      ? or(
          ilike(students.firstName, `%${q}%`),
          ilike(students.lastName, `%${q}%`),
          ilike(students.referenceNumber, `%${q}%`)
        )
      : undefined;

  const linkedToSchoolYear =
    schoolYearId != null
      ? or(
          exists(
            db
              .select({ id: enrollments.id })
              .from(enrollments)
              .where(
                and(
                  eq(enrollments.studentId, students.id),
                  eq(enrollments.schoolYearId, schoolYearId),
                  ne(enrollments.status, "cancelled")
                )
              )
          ),
          exists(
            db
              .select({ id: registrations.id })
              .from(registrations)
              .where(
                and(
                  eq(registrations.studentId, students.id),
                  eq(registrations.schoolYearId, schoolYearId)
                )
              )
          )
        )
      : undefined;

  const listWhere =
    searchWhere && linkedToSchoolYear
      ? and(eq(students.isActive, true), searchWhere, linkedToSchoolYear)
      : searchWhere
        ? and(eq(students.isActive, true), searchWhere)
        : linkedToSchoolYear
          ? and(eq(students.isActive, true), linkedToSchoolYear)
          : eq(students.isActive, true);

  const [schoolYearOptions, rows, countResult] = await Promise.all([
    db
      .select({ id: schoolYears.id, label: schoolYears.label })
      .from(schoolYears)
      .where(isNull(schoolYears.deletedAt))
      .orderBy(desc(schoolYears.startDate)),
    db
      .select({
        id: students.id,
        referenceNumber: students.referenceNumber,
        firstName: students.firstName,
        middleName: students.middleName,
        lastName: students.lastName,
        gender: students.gender,
        dateOfBirth: students.dateOfBirth,
        isActive: students.isActive,
        createdAt: students.createdAt,
      })
      .from(students)
      .where(listWhere)
      .orderBy(desc(students.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(students).where(listWhere),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const canCreate = hasPermission(session.role, "students:create");

  const tableRows: StudentRow[] = rows.map((s) => ({
    id: s.id,
    referenceNumber: s.referenceNumber,
    firstName: s.firstName,
    middleName: s.middleName,
    lastName: s.lastName,
    gender: s.gender,
    dateOfBirthIso: s.dateOfBirth ? new Date(s.dateOfBirth).toISOString() : null,
    isActive: s.isActive,
    createdAtIso: new Date(s.createdAt).toISOString(),
  }));

  const emptyMessage =
    q.trim() && schoolYearId
      ? `No students found matching "${q}" for the selected school year.`
      : q.trim()
        ? `No students found matching "${q}".`
        : schoolYearId
          ? "No students found for the selected school year."
          : "No students have been registered yet.";

  const hasFilters = q.trim() !== "" || schoolYearId != null;
  const qParam = q.trim() || undefined;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">
            Master student records. {totalCount.toLocaleString()} student
            {totalCount !== 1 ? "s" : ""}{" "}
            {hasFilters ? "matching the current filters." : "registered."}
          </p>
        </div>
        {canCreate && (
          <Link href="/admin/students/new" className="btn-primary" id="register-student-btn">
            + Register Student
          </Link>
        )}
      </div>

      <form
        method="GET"
        role="search"
        className="flex items-stretch rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-[var(--shadow-sm)] focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:ring-offset-1 transition-shadow"
      >
        {/* Magnifier icon */}
        <span className="flex items-center pl-4 pr-2.5 text-[var(--color-text-muted)] pointer-events-none">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        </span>

        {/* Input */}
        <input
          id="student-search"
          type="search"
          name="q"
          className="flex-1 min-w-0 bg-transparent py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none"
          placeholder="Search students by name, or reference number..."
          defaultValue={q}
          autoComplete="off"
        />

        <select
          name="schoolYearId"
          defaultValue={schoolYearId ?? ""}
          aria-label="Filter by school year"
          className="min-w-[12rem] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-[0.825rem] text-[var(--color-text)] outline-none"
        >
          <option value="">All school years</option>
          {schoolYearOptions.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
            </option>
          ))}
        </select>

        {hasFilters && (
          <Link
            href="/admin/students"
            className="flex items-center px-3 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] border-l border-[var(--color-border)] transition-colors"
          >
            Clear
          </Link>
        )}

        {/* Search submit */}
        <button type="submit" className="btn-primary rounded-none border-0 px-6 py-3">
          Search
        </button>
      </form>

      <StudentsTable rows={tableRows} emptyMessage={emptyMessage} />

      {totalCount > 0 && (
        <nav
          className="flex items-center justify-between gap-4 px-0.5 py-2"
          aria-label="Student list pagination"
        >
          <p className="pagination-info">
            Page{" "}
            <span className="font-medium text-[var(--color-text)]">{currentPage}</span> of{" "}
            <span className="font-medium text-[var(--color-text)]">{Math.max(totalPages, 1)}</span>
            <span className="ml-2">
              — {totalCount.toLocaleString()} student{totalCount !== 1 ? "s" : ""}
            </span>
          </p>

          <div className="flex items-center gap-2">
            <Link
              href={studentsListHref({
                q: qParam,
                schoolYearId,
                page: currentPage > 2 ? currentPage - 1 : undefined,
              })}
              aria-disabled={currentPage <= 1}
              className={`pagination-btn ${currentPage <= 1 ? "pagination-btn-disabled" : ""}`}
            >
              ← Previous
            </Link>
            <Link
              href={studentsListHref({
                q: qParam,
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
