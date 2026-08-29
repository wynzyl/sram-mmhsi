"use client";

import { useMemo } from "react";
import Image from "next/image";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { SpedBadge } from "@/components/shared/SpedBadge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { getInitials } from "@/lib/utils/name";
import { TablePagination } from "@/components/ui/TablePagination";
import Link from "next/link";
import type {
  PendingEnrollment,
  AssessedEnrollment,
  EnrolledStudent,
  CancelledEnrollment,
} from "../enrollments-queue.queries";
import type { PaginatedResult } from "@/lib/types/pagination";

/**
 * Build base URL for pagination (preserving current tab and filters).
 */
function buildEnrollmentPaginationUrl(
  basePath: string,
  tab: string,
  searchQuery?: string,
  gradeLevelFilter?: string
): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (searchQuery) params.set("search", searchQuery);
  if (gradeLevelFilter && gradeLevelFilter !== "all") params.set("gradeLevel", gradeLevelFilter);
  return `${basePath}?${params.toString()}`;
}

// ─── Pending Enrollments Table ───────────────────────────────────────────────

type PendingEnrollmentsTableProps = {
  paginatedData: PaginatedResult<PendingEnrollment>;
  basePath: string; // e.g., "/staff"
  searchQuery?: string;
  gradeLevelFilter?: string;
  enrollmentsBasePath: string;
  currentTab: string;
};

export function PendingEnrollmentsTable({
  paginatedData,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
  enrollmentsBasePath,
  currentTab,
}: PendingEnrollmentsTableProps) {
  const enrollments = paginatedData.data;

  // Search + grade filters are applied SERVER-SIDE in the queue queries
  // (audit finding F5) — no client re-filtering of the fetched page.
  const filteredEnrollments = enrollments;
  const columns = useMemo<ColumnDef<PendingEnrollment>[]>(
    () => [
      {
        accessorKey: "studentRef",
        header: "Student ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.studentRef}
          </span>
        ),
      },
      {
        accessorKey: "lastName",
        header: "Student Name",
        cell: ({ row }) => {
          const data = row.original;
          return (
            <div className="flex items-center gap-2">
              {data.hasEscDiscount ? (
                <Image
                  src="/ESC-Logo.png"
                  alt="ESC Grantee"
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                  title="ESC Grantee"
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-[10px] font-bold text-primary"
                  aria-hidden
                >
                  {getInitials(`${data.firstName} ${data.lastName}`)}
                </div>
              )}
              <span className="flex items-center">
                <Link
                  href={`${basePath}/students/${data.studentId}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {data.lastName}, {data.firstName}
                </Link>
                <SpedBadge isSped={data.isSpecialEducation} />
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "studentType",
        header: "Type",
        cell: ({ row }) => {
          const type = row.original.studentType;
          const variants: Record<string, { variant: "secondary" | "info" | "success"; label: string }> = {
            new_student: { variant: "info", label: "New" },
            transferee: { variant: "secondary", label: "Transferee" },
            old_student: { variant: "success", label: "Returning" },
          };
          const config = variants[type] ?? { variant: "secondary", label: type };
          return <Badge variant={config.variant}>{config.label}</Badge>;
        },
      },
      {
        accessorKey: "gradeName",
        header: "Grade Level",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.gradeName}</span>
        ),
      },
      {
        accessorKey: "sectionName",
        header: "Section",
        cell: ({ row }) => (
          <span className="text-sm text-foreground">
            {row.original.sectionName ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-helper">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Link
            href={`${basePath}/assessments/new/${row.original.enrollmentId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Create Assessment →
          </Link>
        ),
      },
    ],
    [basePath]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 bg-amber-500/10 border-amber-500/30">
        <p className="text-sm text-amber-600">
          <strong>Pending Enrollments:</strong> These students have been enrolled but are awaiting fee
          assessment. Finance officers should create assessments to move them to the next stage.
        </p>
      </div>
      <DataTable
        columns={columns}
        data={filteredEnrollments}
        searchable={false}
        enablePagination={false}
      />
      <TablePagination
        currentPage={paginatedData.pagination.page}
        totalPages={paginatedData.pagination.totalPages}
        totalRecords={paginatedData.pagination.totalRecords}
        pageSize={paginatedData.pagination.pageSize}
        baseUrl={buildEnrollmentPaginationUrl(enrollmentsBasePath, currentTab, searchQuery, gradeLevelFilter)}
        itemLabel="enrollments"
      />
      {filteredEnrollments.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-secondary">
          No enrollments match the current filters.
        </div>
      )}
    </div>
  );
}

// ─── Assessed Enrollments Table ───────────────────────────────────────────────

type AssessedEnrollmentsTableProps = {
  paginatedData: PaginatedResult<AssessedEnrollment>;
  basePath: string;
  searchQuery?: string;
  gradeLevelFilter?: string;
  enrollmentsBasePath: string;
  currentTab: string;
};

export function AssessedEnrollmentsTable({
  paginatedData,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
  enrollmentsBasePath,
  currentTab,
}: AssessedEnrollmentsTableProps) {
  const enrollments = paginatedData.data;

  // Search + grade filters are applied SERVER-SIDE in the queue queries
  // (audit finding F5) — no client re-filtering of the fetched page.
  const filteredEnrollments = enrollments;
  const columns = useMemo<ColumnDef<AssessedEnrollment>[]>(
    () => [
      {
        accessorKey: "studentRef",
        header: "Student ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.studentRef}
          </span>
        ),
      },
      {
        accessorKey: "lastName",
        header: "Student Name",
        cell: ({ row }) => {
          const data = row.original;
          return (
            <div className="flex items-center gap-2">
              {data.hasEscDiscount ? (
                <Image
                  src="/ESC-Logo.png"
                  alt="ESC Grantee"
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                  title="ESC Grantee"
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-[10px] font-bold text-primary"
                  aria-hidden
                >
                  {getInitials(`${data.firstName} ${data.lastName}`)}
                </div>
              )}
              <span className="flex items-center">
                <Link
                  href={`${basePath}/students/${data.studentId}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {data.lastName}, {data.firstName}
                </Link>
                <SpedBadge isSped={data.isSpecialEducation} />
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "gradeName",
        header: "Grade Level",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.gradeName}</span>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "Total Amount",
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold text-foreground">
            {formatCurrency(Number(row.original.totalAmount))}
          </span>
        ),
      },
      {
        accessorKey: "totalPaid",
        header: "Paid",
        cell: ({ row }) => (
          <span className="font-mono text-sm text-emerald-600">
            {formatCurrency(Number(row.original.totalPaid))}
          </span>
        ),
      },
      {
        accessorKey: "balance",
        header: "Balance",
        cell: ({ row }) => {
          const balance = Number(row.original.balance);
          return (
            <span
              className={`font-mono text-sm font-semibold ${
                balance > 0.01 ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              {formatCurrency(balance)}
            </span>
          );
        },
      },
      {
        accessorKey: "billingStatus",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.billingStatus;
          const config: Record<string, { variant: "success" | "warning" | "danger"; label: string }> = {
            outstanding: { variant: "warning", label: "Outstanding" },
            fully_paid: { variant: "success", label: "Fully Paid" },
            cancelled: { variant: "danger", label: "Cancelled" },
          };
          const badge = config[status] ?? { variant: "warning", label: status };
          return <Badge variant={badge.variant}>{badge.label}</Badge>;
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Link
            href={`${basePath}/assessments/${row.original.assessmentId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View Assessment →
          </Link>
        ),
      },
    ],
    [basePath]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 bg-primary/10 border-primary/30">
        <p className="text-sm text-primary">
          <strong>Assessed Enrollments:</strong> Students with completed fee assessments awaiting payment.
          Cashiers should post payments to move them to enrolled status.
        </p>
      </div>
      <DataTable
        columns={columns}
        data={filteredEnrollments}
        searchable={false}
        enablePagination={false}
      />
      <TablePagination
        currentPage={paginatedData.pagination.page}
        totalPages={paginatedData.pagination.totalPages}
        totalRecords={paginatedData.pagination.totalRecords}
        pageSize={paginatedData.pagination.pageSize}
        baseUrl={buildEnrollmentPaginationUrl(enrollmentsBasePath, currentTab, searchQuery, gradeLevelFilter)}
        itemLabel="enrollments"
      />
      {filteredEnrollments.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-secondary">
          No enrollments match the current filters.
        </div>
      )}
    </div>
  );
}

// ─── Enrolled Students Table ──────────────────────────────────────────────────

type EnrolledStudentsTableProps = {
  paginatedData: PaginatedResult<EnrolledStudent>;
  basePath: string;
  searchQuery?: string;
  gradeLevelFilter?: string;
  enrollmentsBasePath: string;
  currentTab: string;
};

export function EnrolledStudentsTable({
  paginatedData,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
  enrollmentsBasePath,
  currentTab,
}: EnrolledStudentsTableProps) {
  const students = paginatedData.data;

  // Search + grade filters are applied SERVER-SIDE in the queue queries
  // (audit finding F5) — no client re-filtering of the fetched page.
  const filteredStudents = students;
  const columns = useMemo<ColumnDef<EnrolledStudent>[]>(
    () => [
      {
        accessorKey: "studentRef",
        header: "Student ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.studentRef}
          </span>
        ),
      },
      {
        accessorKey: "lastName",
        header: "Student Name",
        cell: ({ row }) => {
          const data = row.original;
          return (
            <div className="flex items-center gap-2">
              {data.hasEscDiscount ? (
                <Image
                  src="/ESC-Logo.png"
                  alt="ESC Grantee"
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                  title="ESC Grantee"
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-[10px] font-bold text-primary"
                  aria-hidden
                >
                  {getInitials(`${data.firstName} ${data.lastName}`)}
                </div>
              )}
              <span className="flex items-center">
                <Link
                  href={`${basePath}/students/${data.studentId}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {data.lastName}, {data.firstName}
                </Link>
                <SpedBadge isSped={data.isSpecialEducation} />
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "studentType",
        header: "Type",
        cell: ({ row }) => {
          const type = row.original.studentType;
          const variants: Record<string, { variant: "secondary" | "info" | "success"; label: string }> = {
            new_student: { variant: "info", label: "New" },
            transferee: { variant: "secondary", label: "Transferee" },
            old_student: { variant: "success", label: "Returning" },
          };
          const config = variants[type] ?? { variant: "secondary", label: type };
          return <Badge variant={config.variant}>{config.label}</Badge>;
        },
      },
      {
        accessorKey: "gradeName",
        header: "Grade Level",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.gradeName}</span>
        ),
      },
      {
        accessorKey: "sectionName",
        header: "Section",
        cell: ({ row }) => (
          <span className="text-sm text-foreground">
            {row.original.sectionName ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "enrolledAt",
        header: "Enrolled On",
        cell: ({ row }) => (
          <span className="text-helper">
            {formatDate(row.original.enrolledAt)}
          </span>
        ),
      },
    ],
    [basePath]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 bg-emerald-500/10 border-emerald-500/30">
        <p className="text-sm text-emerald-600">
          <strong>Enrolled Students:</strong> Fully enrolled students for the current school year.
        </p>
      </div>
      <DataTable
        columns={columns}
        data={filteredStudents}
        searchable={false}
        enablePagination={false}
      />
      <TablePagination
        currentPage={paginatedData.pagination.page}
        totalPages={paginatedData.pagination.totalPages}
        totalRecords={paginatedData.pagination.totalRecords}
        pageSize={paginatedData.pagination.pageSize}
        baseUrl={buildEnrollmentPaginationUrl(enrollmentsBasePath, currentTab, searchQuery, gradeLevelFilter)}
        itemLabel="students"
      />
      {filteredStudents.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-secondary">
          No students match the current filters.
        </div>
      )}
    </div>
  );
}

// ─── Cancelled Enrollments Table ──────────────────────────────────────────────

type CancelledEnrollmentsTableProps = {
  paginatedData: PaginatedResult<CancelledEnrollment>;
  basePath: string;
  searchQuery?: string;
  gradeLevelFilter?: string;
  enrollmentsBasePath: string;
  currentTab: string;
};

export function CancelledEnrollmentsTable({
  paginatedData,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
  enrollmentsBasePath,
  currentTab,
}: CancelledEnrollmentsTableProps) {
  const enrollments = paginatedData.data;

  // Search + grade filters are applied SERVER-SIDE in the queue queries
  // (audit finding F5) — no client re-filtering of the fetched page.
  const filteredEnrollments = enrollments;
  const columns = useMemo<ColumnDef<CancelledEnrollment>[]>(
    () => [
      {
        accessorKey: "studentRef",
        header: "Student ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.studentRef}
          </span>
        ),
      },
      {
        accessorKey: "lastName",
        header: "Student Name",
        cell: ({ row }) => {
          const data = row.original;
          return (
            <div className="flex items-center gap-2">
              {data.hasEscDiscount ? (
                <Image
                  src="/ESC-Logo.png"
                  alt="ESC Grantee"
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded-full object-cover opacity-60"
                  title="ESC Grantee"
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-[10px] font-bold text-primary opacity-60"
                  aria-hidden
                >
                  {getInitials(`${data.firstName} ${data.lastName}`)}
                </div>
              )}
              <span className="flex items-center">
                <Link
                  href={`${basePath}/students/${data.studentId}`}
                  className="font-semibold text-muted-foreground hover:underline"
                >
                  {data.lastName}, {data.firstName}
                </Link>
                <SpedBadge isSped={data.isSpecialEducation} />
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "studentType",
        header: "Type",
        cell: ({ row }) => {
          const type = row.original.studentType;
          const variants: Record<string, { variant: "secondary" | "info" | "success"; label: string }> = {
            new_student: { variant: "info", label: "New" },
            transferee: { variant: "secondary", label: "Transferee" },
            old_student: { variant: "success", label: "Returning" },
          };
          const config = variants[type] ?? { variant: "secondary", label: type };
          return <Badge variant={config.variant}>{config.label}</Badge>;
        },
      },
      {
        accessorKey: "gradeName",
        header: "Grade Level",
        cell: ({ row }) => (
          <span className="font-medium text-muted-foreground">{row.original.gradeName}</span>
        ),
      },
      {
        accessorKey: "cancelledAt",
        header: "Cancelled On",
        cell: ({ row }) => (
          <span className="text-helper">
            {formatDate(row.original.cancelledAt)}
          </span>
        ),
      },
      {
        accessorKey: "cancelRemarks",
        header: "Remarks",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground line-clamp-2">
            {row.original.cancelRemarks ?? "—"}
          </span>
        ),
      },
    ],
    [basePath]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 bg-destructive/10 border-destructive/30">
        <p className="text-sm text-destructive">
          <strong>Cancelled Enrollments:</strong> Enrollments that were cancelled for this school year.
        </p>
      </div>
      <DataTable
        columns={columns}
        data={filteredEnrollments}
        searchable={false}
        enablePagination={false}
      />
      <TablePagination
        currentPage={paginatedData.pagination.page}
        totalPages={paginatedData.pagination.totalPages}
        totalRecords={paginatedData.pagination.totalRecords}
        pageSize={paginatedData.pagination.pageSize}
        baseUrl={buildEnrollmentPaginationUrl(enrollmentsBasePath, currentTab, searchQuery, gradeLevelFilter)}
        itemLabel="enrollments"
      />
      {filteredEnrollments.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-secondary">
          No enrollments match the current filters.
        </div>
      )}
    </div>
  );
}
