import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { students, parentsGuardians, studentGuardianLinks, registrations, schoolYears, gradeLevels } from "@/lib/db/schema";
import { eq, desc, ilike, or, and, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";

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

  // Build where clause
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

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">
            {totalCount.toLocaleString()} student{totalCount !== 1 ? "s" : ""} registered
          </p>
        </div>
        {canCreate && (
          <Link href="/admin/students/new" className="btn-primary" id="register-student-btn">
            + Register Student
          </Link>
        )}
      </div>

      {/* Search */}
      <form method="GET" className="search-bar" role="search">
        <div className="search-input-wrapper">
          <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            id="student-search"
            type="search"
            name="q"
            className="search-input"
            placeholder="Search by name or reference number..."
            defaultValue={q}
            autoComplete="off"
          />
        </div>
        <button type="submit" className="btn-primary">Search</button>
        {q && (
          <Link href="/admin/students" className="btn-ghost">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table" id="students-table">
          <thead>
            <tr>
              <th>Reference No.</th>
              <th>Full Name</th>
              <th>Gender</th>
              <th>Registered</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  {q ? `No students found matching "${q}"` : "No students registered yet."}
                </td>
              </tr>
            ) : (
              rows.map((student) => (
                <tr key={student.id} className="table-row-hover">
                  <td>
                    <code className="reference-code">{student.referenceNumber}</code>
                  </td>
                  <td className="student-name">
                    {student.lastName}, {student.firstName}
                    {student.middleName ? ` ${student.middleName[0]}.` : ""}
                  </td>
                  <td className="text-capitalize">{student.gender ?? "—"}</td>
                  <td className="text-muted">
                    {new Date(student.createdAt).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    <span className={`badge ${student.isActive ? "badge-success" : "badge-danger"}`}>
                      {student.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/admin/students/${student.id}`}
                      className="table-action-link"
                      id={`view-student-${student.id}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="pagination" aria-label="Student list pagination">
          <Link
            href={`/admin/students?q=${q}&page=${currentPage - 1}`}
            className={`pagination-btn ${currentPage <= 1 ? "pagination-btn-disabled" : ""}`}
            aria-disabled={currentPage <= 1}
          >
            ← Prev
          </Link>
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <Link
            href={`/admin/students?q=${q}&page=${currentPage + 1}`}
            className={`pagination-btn ${currentPage >= totalPages ? "pagination-btn-disabled" : ""}`}
            aria-disabled={currentPage >= totalPages}
          >
            Next →
          </Link>
        </nav>
      )}
    </div>
  );
}
