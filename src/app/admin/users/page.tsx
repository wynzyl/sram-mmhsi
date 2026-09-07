import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { desc, ilike, or, and, isNull, eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { ROLE_LABELS, type Role } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils/date";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "User Management",
  description: "Manage user accounts in SRAMS.",
};

interface PageProps {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}

const PAGE_SIZE = 20;

/**
 * Instant navigation - full users page skeleton shown while data loads.
 */
export default function UsersPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<UsersPageSkeleton />}>
      <UsersPageContent searchParams={searchParams} />
    </Suspense>
  );
}

function UsersPageSkeleton() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-36 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Search and Filter skeleton */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-sm)]">
        <Skeleton className="h-10 flex-1 min-w-[18rem]" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-20" />
      </div>

      {/* Table skeleton */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Username</th>
              <th>Role</th>
              <th>Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td><Skeleton className="h-4 w-40" /></td>
                <td><Skeleton className="h-4 w-20" /></td>
                <td><Skeleton className="h-4 w-16" /></td>
                <td><Skeleton className="h-4 w-24" /></td>
                <td><Skeleton className="h-4 w-14" /></td>
                <td><Skeleton className="h-4 w-10" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function UsersPageContent({ searchParams }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "users:manage")) redirect("/admin/dashboard");

  const { q = "", role = "", page = "1" } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Build where clause
  const conditions = [isNull(users.deletedAt)];

  if (q) {
    conditions.push(
      or(
        ilike(users.email, `%${q}%`),
        ilike(users.username, `%${q}%`)
      )!
    );
  }

  if (role) {
    conditions.push(eq(users.role, role as Role));
  }

  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(where),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage user accounts</p>
        </div>
        <Link href="/admin/users/new" className="btn-primary" id="create-user-btn">
          + Create User
        </Link>
      </div>

      {/* Search and Filter */}
      <form
        method="GET"
        role="search"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-sm)]"
      >
        <div className="relative min-w-[18rem] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            id="user-search"
            type="search"
            name="q"
            className="form-control pl-9"
            placeholder="Search by email or username..."
            defaultValue={q}
            autoComplete="off"
          />
        </div>
        <select name="role" className="form-control w-auto min-w-48" defaultValue={role}>
          <option value="">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">Search</button>
        {(q || role) && (
          <Link href="/admin/users" className="btn-secondary">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table" id="users-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Username</th>
              <th>Role</th>
              <th>Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  {q || role ? "No users found matching your filters." : "No users registered yet."}
                </td>
              </tr>
            ) : (
              rows.map((user) => (
                <tr key={user.id} className="table-row-hover">
                  <td>{user.email}</td>
                  <td>
                    <code className="reference-code">{user.username}</code>
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
                    </span>
                  </td>
                  <td className="text-muted">
                    {formatDate(user.createdAt, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    <span className={`badge ${user.isActive ? "badge-success" : "badge-danger"}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="table-action-link"
                      id={`view-user-${user.id}`}
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
        <nav className="pagination" aria-label="User list pagination">
          <Link
            href={`/admin/users?q=${q}&role=${role}&page=${currentPage - 1}`}
            className={`pagination-btn ${currentPage <= 1 ? "pagination-btn-disabled" : ""}`}
            aria-disabled={currentPage <= 1}
          >
            ← Prev
          </Link>
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <Link
            href={`/admin/users?q=${q}&role=${role}&page=${currentPage + 1}`}
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
