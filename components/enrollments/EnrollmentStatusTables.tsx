"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-display/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import Link from "next/link";
import type {
  PendingEnrollment,
  AssessedEnrollment,
  EnrolledStudent,
  CancelledEnrollment,
} from "@/lib/queries/enrollment-queue";

// ─── Pending Enrollments Table ───────────────────────────────────────────────

type PendingEnrollmentsTableProps = {
  enrollments: PendingEnrollment[];
  basePath: string; // e.g., "/staff"
  searchQuery?: string;
  gradeLevelFilter?: string;
};

export function PendingEnrollmentsTable({
  enrollments,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
}: PendingEnrollmentsTableProps) {
  // Apply filters
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
          <span className="font-mono text-xs text-[var(--color-text-muted)]">
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
            className="font-semibold text-[var(--color-primary)] hover:underline"
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
          <span className="font-medium text-[var(--color-text)]">{row.original.gradeName}</span>
        ),
      },
      {
        accessorKey: "sectionName",
        header: "Section",
        cell: ({ row }) => (
          <span className="text-sm text-[var(--color-text)]">
            {row.original.sectionName ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-xs text-[var(--color-text-muted)]">
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
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
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
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <strong>Pending Enrollments:</strong> These students have been enrolled but are awaiting fee
          assessment. Finance officers should create assessments to move them to the next stage.
        </p>
      </div>
      <DataTable
        columns={columns}
        data={filteredEnrollments}
        searchable={false}
        pageSize={25}
      />
      {filteredEnrollments.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-sm text-[var(--color-text-muted)]">
          No enrollments match the current filters.
        </div>
      )}
    </div>
  );
}

// ─── Assessed Enrollments Table ───────────────────────────────────────────────

type AssessedEnrollmentsTableProps = {
  enrollments: AssessedEnrollment[];
  basePath: string;
  searchQuery?: string;
  gradeLevelFilter?: string;
};

export function AssessedEnrollmentsTable({
  enrollments,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
}: AssessedEnrollmentsTableProps) {
  // Apply filters
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
          <span className="font-mono text-xs text-[var(--color-text-muted)]">
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
            className="font-semibold text-[var(--color-primary)] hover:underline"
          >
            {row.original.lastName}, {row.original.firstName}
          </Link>
        ),
      },
      {
        accessorKey: "gradeName",
        header: "Grade Level",
        cell: ({ row }) => (
          <span className="font-medium text-[var(--color-text)]">{row.original.gradeName}</span>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "Total Amount",
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold text-[var(--color-text)]">
            {formatCurrency(Number(row.original.totalAmount))}
          </span>
        ),
      },
      {
        accessorKey: "totalPaid",
        header: "Paid",
        cell: ({ row }) => (
          <span className="font-mono text-sm text-green-700">
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
                balance > 0.01 ? "text-amber-600" : "text-green-700"
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
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
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
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <strong>Assessed Enrollments:</strong> Students with completed fee assessments awaiting payment.
          Cashiers should post payments to move them to enrolled status.
        </p>
      </div>
      <DataTable
        columns={columns}
        data={filteredEnrollments}
        searchable={false}
        pageSize={25}
      />
      {filteredEnrollments.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-sm text-[var(--color-text-muted)]">
          No enrollments match the current filters.
        </div>
      )}
    </div>
  );
}

// ─── Enrolled Students Table ──────────────────────────────────────────────────

type EnrolledStudentsTableProps = {
  students: EnrolledStudent[];
  basePath: string;
  searchQuery?: string;
  gradeLevelFilter?: string;
};

export function EnrolledStudentsTable({
  students,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
}: EnrolledStudentsTableProps) {
  // Apply filters
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
          <span className="font-mono text-xs text-[var(--color-text-muted)]">
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
            className="font-semibold text-[var(--color-primary)] hover:underline"
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
          <span className="font-medium text-[var(--color-text)]">{row.original.gradeName}</span>
        ),
      },
      {
        accessorKey: "sectionName",
        header: "Section",
        cell: ({ row }) => (
          <span className="text-sm text-[var(--color-text)]">
            {row.original.sectionName ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "enrolledAt",
        header: "Enrolled On",
        cell: ({ row }) => (
          <span className="text-xs text-[var(--color-text-muted)]">
            {formatDate(row.original.enrolledAt)}
          </span>
        ),
      },
    ],
    [basePath]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-green-200 bg-green-50 p-4">
        <p className="text-sm text-green-800">
          <strong>Enrolled Students:</strong> Fully enrolled students for the current school year.
        </p>
      </div>
      <DataTable
        columns={columns}
        data={filteredStudents}
        searchable={false}
        pageSize={25}
      />
      {filteredStudents.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-sm text-[var(--color-text-muted)]">
          No students match the current filters.
        </div>
      )}
    </div>
  );
}

// ─── Cancelled Enrollments Table ──────────────────────────────────────────────

type CancelledEnrollmentsTableProps = {
  enrollments: CancelledEnrollment[];
  basePath: string;
  searchQuery?: string;
  gradeLevelFilter?: string;
};

export function CancelledEnrollmentsTable({
  enrollments,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
}: CancelledEnrollmentsTableProps) {
  // Apply filters
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
          <span className="font-mono text-xs text-[var(--color-text-muted)]">
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
            className="font-semibold text-[var(--color-text-muted)] hover:underline"
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
          <span className="font-medium text-[var(--color-text-muted)]">{row.original.gradeName}</span>
        ),
      },
      {
        accessorKey: "cancelledAt",
        header: "Cancelled On",
        cell: ({ row }) => (
          <span className="text-xs text-[var(--color-text-muted)]">
            {formatDate(row.original.cancelledAt)}
          </span>
        ),
      },
      {
        accessorKey: "cancelRemarks",
        header: "Remarks",
        cell: ({ row }) => (
          <span className="text-xs text-[var(--color-text-muted)] line-clamp-2">
            {row.original.cancelRemarks ?? "—"}
          </span>
        ),
      },
    ],
    [basePath]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          <strong>Cancelled Enrollments:</strong> Enrollments that were cancelled for this school year.
        </p>
      </div>
      <DataTable
        columns={columns}
        data={filteredEnrollments}
        searchable={false}
        pageSize={25}
      />
      {filteredEnrollments.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="text-center text-sm text-[var(--color-text-muted)]">
          No enrollments match the current filters.
        </div>
      )}
    </div>
  );
}
