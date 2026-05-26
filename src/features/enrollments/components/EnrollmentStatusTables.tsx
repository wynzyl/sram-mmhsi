"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { PaginationControls } from "@/components/shared/PaginationControls";
import Link from "next/link";
import type {
  PendingEnrollment,
  AssessedEnrollment,
  EnrolledStudent,
  CancelledEnrollment,
} from "../enrollments-queue.queries";
import type { PaginatedResult } from "@/lib/types/pagination";

// ─── Pending Enrollments Table ───────────────────────────────────────────────

type PendingEnrollmentsTableProps = {
  paginatedData: PaginatedResult<PendingEnrollment>;
  basePath: string; // e.g., "/staff"
  searchQuery?: string;
  gradeLevelFilter?: string;
  enrollmentsBasePath: string;
};

export function PendingEnrollmentsTable({
  paginatedData,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
  enrollmentsBasePath,
}: PendingEnrollmentsTableProps) {
  const enrollments = paginatedData.data;

  // Apply client-side filters (pagination already handled server-side)
  const filteredEnrollments = useMemo(() => {
    let filtered = enrollments;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.firstName.toLowerCase().includes(query) ||
          e.lastName.toLowerCase().includes(query) ||
          e.studentRef.toLowerCase().includes(query)
      );
    }

    // Filter by grade level
    if (gradeLevelFilter && gradeLevelFilter !== "all") {
      filtered = filtered.filter((e) => e.gradeLevelId === gradeLevelFilter);
    }

    return filtered;
  }, [enrollments, searchQuery, gradeLevelFilter]);
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
        cell: ({ row }) => (
          <Link
            href={`${basePath}/students/${row.original.studentId}`}
            className="font-semibold text-primary hover:underline"
          >
            {row.original.lastName}, {row.original.firstName}
          </Link>
        ),
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
          <span className="text-xs text-muted-foreground">
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
      <PaginationControls pagination={paginatedData.pagination} basePath={enrollmentsBasePath} />
      {filteredEnrollments.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-sm text-muted-foreground">
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
};

export function AssessedEnrollmentsTable({
  paginatedData,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
  enrollmentsBasePath,
}: AssessedEnrollmentsTableProps) {
  const enrollments = paginatedData.data;

  // Apply client-side filters (pagination already handled server-side)
  const filteredEnrollments = useMemo(() => {
    let filtered = enrollments;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.firstName.toLowerCase().includes(query) ||
          e.lastName.toLowerCase().includes(query) ||
          e.studentRef.toLowerCase().includes(query)
      );
    }

    if (gradeLevelFilter && gradeLevelFilter !== "all") {
      filtered = filtered.filter((e) => e.gradeLevelId === gradeLevelFilter);
    }

    return filtered;
  }, [enrollments, searchQuery, gradeLevelFilter]);
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
        cell: ({ row }) => (
          <Link
            href={`${basePath}/students/${row.original.studentId}`}
            className="font-semibold text-primary hover:underline"
          >
            {row.original.lastName}, {row.original.firstName}
          </Link>
        ),
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
      <PaginationControls pagination={paginatedData.pagination} basePath={enrollmentsBasePath} />
      {filteredEnrollments.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-sm text-muted-foreground">
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
};

export function EnrolledStudentsTable({
  paginatedData,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
  enrollmentsBasePath,
}: EnrolledStudentsTableProps) {
  const students = paginatedData.data;

  // Apply client-side filters (pagination already handled server-side)
  const filteredStudents = useMemo(() => {
    let filtered = students;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.firstName.toLowerCase().includes(query) ||
          s.lastName.toLowerCase().includes(query) ||
          s.studentRef.toLowerCase().includes(query)
      );
    }

    if (gradeLevelFilter && gradeLevelFilter !== "all") {
      filtered = filtered.filter((s) => s.gradeLevelId === gradeLevelFilter);
    }

    return filtered;
  }, [students, searchQuery, gradeLevelFilter]);
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
        cell: ({ row }) => (
          <Link
            href={`${basePath}/students/${row.original.studentId}`}
            className="font-semibold text-primary hover:underline"
          >
            {row.original.lastName}, {row.original.firstName}
          </Link>
        ),
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
          <span className="text-xs text-muted-foreground">
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
      <PaginationControls pagination={paginatedData.pagination} basePath={enrollmentsBasePath} />
      {filteredStudents.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-sm text-muted-foreground">
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
};

export function CancelledEnrollmentsTable({
  paginatedData,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
  enrollmentsBasePath,
}: CancelledEnrollmentsTableProps) {
  const enrollments = paginatedData.data;

  // Apply client-side filters (pagination already handled server-side)
  const filteredEnrollments = useMemo(() => {
    let filtered = enrollments;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.firstName.toLowerCase().includes(query) ||
          e.lastName.toLowerCase().includes(query) ||
          e.studentRef.toLowerCase().includes(query)
      );
    }

    if (gradeLevelFilter && gradeLevelFilter !== "all") {
      filtered = filtered.filter((e) => e.gradeLevelId === gradeLevelFilter);
    }

    return filtered;
  }, [enrollments, searchQuery, gradeLevelFilter]);
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
        cell: ({ row }) => (
          <Link
            href={`${basePath}/students/${row.original.studentId}`}
            className="font-semibold text-muted-foreground hover:underline"
          >
            {row.original.lastName}, {row.original.firstName}
          </Link>
        ),
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
          <span className="text-xs text-muted-foreground">
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
      <PaginationControls pagination={paginatedData.pagination} basePath={enrollmentsBasePath} />
      {filteredEnrollments.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-sm text-muted-foreground">
          No enrollments match the current filters.
        </div>
      )}
    </div>
  );
}
