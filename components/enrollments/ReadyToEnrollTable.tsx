"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-display/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, FileText, UserPlus } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import type { ReadyToEnrollStudent } from "@/lib/queries/enrollment-queue";

type ReadyToEnrollTableProps = {
  students: ReadyToEnrollStudent[];
  onConfirmEnrollment: (student: ReadyToEnrollStudent) => void;
};

export function ReadyToEnrollTable({ students, onConfirmEnrollment }: ReadyToEnrollTableProps) {
  const columns = useMemo<ColumnDef<ReadyToEnrollStudent>[]>(
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
          <div className="flex flex-col">
            <span className="font-semibold text-[var(--color-text)]">
              {row.original.lastName}, {row.original.firstName}
            </span>
          </div>
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
        id: "gradeLevel",
        header: "Enrolling Grade",
        cell: ({ row }) => {
          const student = row.original;

          if (student.studentType === "old_student") {
            return (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-[var(--color-text-muted)]">
                  Previous: {student.previousGradeName}
                </span>
                <span className="font-medium text-[var(--color-text)]">
                  → {student.suggestedGradeName}
                </span>
              </div>
            );
          }

          return (
            <span className="font-medium text-[var(--color-text)]">
              {student.registrationGradeName}
            </span>
          );
        },
      },
      {
        id: "documents",
        header: "Documents",
        cell: ({ row }) => {
          const student = row.original;

          // Old students don't need document check
          if (student.studentType === "old_student") {
            return (
              <span className="text-xs text-[var(--color-text-muted)]">N/A</span>
            );
          }

          return student.hasCompleteDocuments ? (
            <div className="flex items-center gap-1.5 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Complete</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-600">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-medium">Incomplete</span>
            </div>
          );
        },
      },
      {
        id: "balance",
        header: "Balance Status",
        cell: ({ row }) => {
          const student = row.original;

          // Only old students have balance info
          if (student.studentType !== "old_student") {
            return <span className="text-xs text-[var(--color-text-muted)]">N/A</span>;
          }

          return student.hasOutstandingBalance ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-semibold">Outstanding</span>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">
                {formatCurrency(Number(student.outstandingAmount ?? 0))}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Clear</span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => {
          const student = row.original;
          return (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onConfirmEnrollment(student)}
              className="gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {student.studentType === "old_student" ? "Re-Enroll" : "Enroll"}
            </Button>
          );
        },
      },
    ],
    [onConfirmEnrollment]
  );

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900">Ready to Enroll Queue</h3>
            <p className="mt-1 text-sm text-blue-700">
              Students in this list are eligible for enrollment confirmation. Review their details and click{" "}
              <strong>Enroll</strong> or <strong>Re-Enroll</strong> to create a pending enrollment record.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={students}
        searchable
        searchPlaceholder="Search by name or student ID..."
        pageSize={25}
      />
    </div>
  );
}
