"use client";

import { useMemo } from "react";
import Image from "next/image";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SpedBadge } from "@/components/shared/SpedBadge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, FileText, UserPlus } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { getInitials } from "@/lib/utils/name";
import type { ReadyToEnrollListRow } from "../enrollments-queue.queries";

type GradeLevel = {
  id: string;
  name: string;
};

type ReadyToEnrollTableProps = {
  students: ReadyToEnrollListRow[];
  onConfirmEnrollment: (student: ReadyToEnrollListRow) => void;
  gradeLevels?: GradeLevel[];
  searchQuery?: string;
  gradeLevelFilter?: string;
};

export default function ReadyToEnrollTable({
  students,
  onConfirmEnrollment,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Kept for future filter UI
  gradeLevels: _gradeLevels = [],
  searchQuery = "",
  gradeLevelFilter = "",
}: ReadyToEnrollTableProps) {
  // Search + grade filters are applied SERVER-SIDE in getReadyToEnrollList
  // (audit finding F5) — re-filtering here would only hide rows of the
  // already-filtered page. Props are kept for the empty-state message below.
  const filteredStudents = students;

  const columns = useMemo<ColumnDef<ReadyToEnrollListRow>[]>(
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
          const student = row.original;
          return (
            <div className="flex items-center gap-3">
              {student.hasEscDiscount ? (
                <Image
                  src="/ESC-Logo.png"
                  alt="ESC Grantee"
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                  title="ESC Grantee"
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-bold text-primary"
                  aria-hidden
                >
                  {getInitials(`${student.firstName} ${student.lastName}`)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="flex items-center font-semibold text-foreground">
                  {student.lastName}, {student.firstName}
                  <SpedBadge isSped={student.isSpecialEducation} />
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "studentType",
        header: "Type",
        cell: ({ row }) => (
          <StatusBadge status={row.original.studentType} type="studentType" />
        ),
      },
      {
        id: "gradeLevel",
        header: "Enrolling Grade",
        cell: ({ row }) => {
          const student = row.original;

          if (student.studentType === "old_student") {
            return (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  Previous: {student.previousGradeName}
                </span>
                <span className="font-medium text-foreground">
                  → {student.suggestedGradeName}
                </span>
              </div>
            );
          }

          return (
            <span className="font-medium text-foreground">
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
              <span className="text-xs text-muted-foreground">N/A</span>
            );
          }

          return student.hasCompleteDocuments ? (
            <div className="flex items-center gap-1.5 text-success">
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
            return <span className="text-xs text-muted-foreground">N/A</span>;
          }

          return student.hasOutstandingBalance ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-semibold">Outstanding</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(Number(student.outstandingAmount ?? 0))}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-success">
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
      <div
        className="rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950"
      >
        <div className="flex items-start gap-3">
          <FileText
            className="mt-0.5 h-5 w-5 text-emerald-600"
          />
          <div className="flex-1">
            <h3
              className="text-sm font-semibold text-emerald-600"
            >
              Ready to Enroll Queue
            </h3>
            <p
              className="mt-1 text-sm text-emerald-600"
            >
              Students in this list are eligible for enrollment confirmation. Review their details and click{" "}
              <strong>Enroll</strong> or <strong>Re-Enroll</strong> to create a pending enrollment record.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredStudents}
        searchable={false}
        enablePagination={false}
      />

      {/* Results Summary */}
      {filteredStudents.length === 0 && (searchQuery || gradeLevelFilter) && (
        <div className="mt-4 text-center text-secondary">
          No students match the current filters. Try adjusting your search or grade level filter.
        </div>
      )}
    </div>
  );
}
