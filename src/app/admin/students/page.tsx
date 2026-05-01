import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq, desc, ilike, or, and, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { StudentsTable, type StudentRow } from "@/components/students/StudentsTable";

export const metadata: Metadata = {
  title: "Students",
  description: "Manage student records in SRAMS.",
};

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

const PAGE_SIZE = 20;

export default async function StudentsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "students:read")) redirect("/admin/dashboard");

  const { q = "", page = "1" } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const where = q
    ? or(
        ilike(students.firstName, `%${q}%`),
        ilike(students.lastName, `%${q}%`),
        ilike(students.referenceNumber, `%${q}%`)
      )
    : undefined;

  const [rows, countResult] = await Promise.all([
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
      .where(where ? and(where, eq(students.isActive, true)) : eq(students.isActive, true))
      .orderBy(desc(students.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(where ? and(where, eq(students.isActive, true)) : eq(students.isActive, true)),
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

  return (
    <div className="page-container">

      {/* ── Row 1: title + primary action ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">
            {totalCount.toLocaleString()} student{totalCount !== 1 ? "s" : ""} registered
          </p>
        </div>
        {canCreate && (
          <Link
            href="/admin/students/new"
            id="register-student-btn"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-semibold hover:bg-[var(--color-primary)] hover:text-white transition-colors duration-150"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Register Student
          </Link>
        )}
      </div>

      {/* ── Row 2: full-width search bar ── */}
      <form method="GET" role="search" className="flex items-stretch mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:ring-offset-1 transition-shadow">
        {/* Magnifier icon */}
        <span className="flex items-center pl-4 pr-2 text-[var(--color-text-muted)] pointer-events-none">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        </span>

        {/* Input */}
        <input
          id="student-search"
          type="search"
          name="q"
          className="flex-1 min-w-0 bg-transparent py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none"
          placeholder="Search students by name, or reference number..."
          defaultValue={q}
          autoComplete="off"
        />

        {/* Clear — only when a query is active */}
        {q && (
          <Link
            href="/admin/students"
            className="flex items-center px-3 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] border-l border-[var(--color-border)] transition-colors"
          >
            Clear
          </Link>
        )}

        {/* Search submit */}
        <button
          type="submit"
          className="px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Search
        </button>
      </form>

      {/* ── Table ── */}
      {tableRows.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center text-sm text-[var(--color-text-muted)]">
          {q ? `No students found matching "${q}"` : "No students have been registered yet."}
        </div>
      ) : (
        <StudentsTable rows={tableRows} />
      )}

      {/* ── Pagination — always visible when there are rows ── */}
      {totalCount > 0 && (
        <nav
          className="flex items-center justify-between mt-4 px-1"
          aria-label="Student list pagination"
        >
          {/* Page / count info */}
          <p className="text-sm text-[var(--color-text-muted)]">
            Page{" "}
            <span className="font-medium text-[var(--color-text)]">{currentPage}</span>
            {" "}of{" "}
            <span className="font-medium text-[var(--color-text)]">{Math.max(totalPages, 1)}</span>
            <span className="ml-2 text-xs">
              &mdash; {totalCount.toLocaleString()} student{totalCount !== 1 ? "s" : ""}
            </span>
          </p>

          {/* Prev / Next */}
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/students?q=${encodeURIComponent(q)}&page=${currentPage - 1}`}
              aria-disabled={currentPage <= 1}
              className={[
                "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors",
                currentPage <= 1
                  ? "border-[var(--color-border)] text-[var(--color-text-muted)] pointer-events-none opacity-40 cursor-default"
                  : "border-[var(--color-border-2)] text-[var(--color-text-2)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-3)]",
              ].join(" ")}
            >
              ← Previous
            </Link>
            <Link
              href={`/admin/students?q=${encodeURIComponent(q)}&page=${currentPage + 1}`}
              aria-disabled={currentPage >= totalPages}
              className={[
                "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors",
                currentPage >= totalPages
                  ? "border-[var(--color-border)] text-[var(--color-text-muted)] pointer-events-none opacity-40 cursor-default"
                  : "border-[var(--color-border-2)] text-[var(--color-text-2)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-3)]",
              ].join(" ")}
            >
              Next →
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
