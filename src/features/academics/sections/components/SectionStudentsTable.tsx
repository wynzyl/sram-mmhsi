"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StudentInSection } from "../sections.schema";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, GitBranch, AlertTriangle, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import type { StrandOption } from "@/features/academics/strands";
import type { CanChangeStrandResult } from "@/features/academics/student-subject-enrollments";
import { ChangeStrandDialog } from "@/features/academics/student-subject-enrollments";
import { BulkStrandAssignDialog } from "@/features/academics/student-subject-enrollments/components/BulkStrandAssignDialog";
import { cn } from "@/lib/utils/cn";

interface SectionStudentsTableProps {
  students: StudentInSection[];
  /** Whether this is an SHS section (Grade 11-12) - enables strand features */
  isShs?: boolean;
  /** Available strands for assignment (only needed for SHS) */
  availableStrands?: StrandOption[];
  /** Function to check if student can change strand */
  onCheckCanChangeStrand?: (enrollmentId: string) => Promise<CanChangeStrandResult>;
}

/**
 * Table showing enrolled students in a section.
 * Used in section detail page and grade entry screens.
 * Shows strand column and change strand action for SHS sections.
 */
export default function SectionStudentsTable({
  students,
  isShs = false,
  availableStrands = [],
  onCheckCanChangeStrand,
}: SectionStudentsTableProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedStudent, setSelectedStudent] = useState<StudentInSection | null>(null);
  const [strandInfo, setStrandInfo] = useState<CanChangeStrandResult | null>(null);
  const [isLoadingStrandInfo, setIsLoadingStrandInfo] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);

  // Count students missing strand assignment
  const studentsWithoutStrand = students.filter((s) => !s.strandId);
  const missingStrandCount = studentsWithoutStrand.length;

  // Get selected enrollment IDs for bulk action
  const selectedEnrollmentIds = Object.keys(rowSelection)
    .filter((key) => rowSelection[key])
    .map((idx) => students[parseInt(idx)]?.enrollmentId)
    .filter(Boolean);

  // Filter selected students to only those without strands (for bulk assign)
  const selectedWithoutStrand = Object.keys(rowSelection)
    .filter((key) => rowSelection[key])
    .map((idx) => students[parseInt(idx)])
    .filter((s) => s && !s.strandId);

  const handleOpenChangeStrand = async (student: StudentInSection) => {
    if (!onCheckCanChangeStrand) return;

    setSelectedStudent(student);
    setIsLoadingStrandInfo(true);

    try {
      const info = await onCheckCanChangeStrand(student.enrollmentId);
      setStrandInfo(info);
    } catch (error) {
      console.error("Failed to check strand change eligibility:", error);
      setStrandInfo({
        canChange: false,
        reason: "Failed to check eligibility",
        gradeCount: 0,
        currentStrandId: student.strandId,
        currentStrandCode: student.strandCode as never,
        currentStrandName: student.strandName,
      });
    } finally {
      setIsLoadingStrandInfo(false);
    }
  };

  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setSelectedStudent(null);
      setStrandInfo(null);
      // Refresh to get updated data
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleCloseBulkDialog = (open: boolean) => {
    if (!open) {
      setShowBulkAssignDialog(false);
      setRowSelection({});
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const columns = useMemo<ColumnDef<StudentInSection>[]>(() => {
    const baseColumns: ColumnDef<StudentInSection>[] = [];

    // Add checkbox column for SHS bulk selection
    if (isShs && onCheckCanChangeStrand) {
      baseColumns.push({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      });
    }

    baseColumns.push(
      {
        header: "Ref. No.",
        accessorKey: "studentRef",
        cell: ({ row }) => (
          <Link
            href={`/staff/students/${row.original.studentId}`}
            className="font-mono text-sm text-primary hover:underline"
          >
            {row.original.studentRef}
          </Link>
        ),
      },
      {
        header: "Last Name",
        accessorKey: "lastName",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.lastName}</span>
        ),
      },
      {
        header: "First Name",
        accessorKey: "firstName",
        cell: ({ row }) => <span>{row.original.firstName}</span>,
      },
      {
        header: "Middle Name",
        accessorKey: "middleName",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.middleName || "—"}
          </span>
        ),
      },
      {
        header: "Suffix",
        accessorKey: "suffix",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.suffix || "—"}
          </span>
        ),
      }
    );

    // Add strand column for SHS sections with inline assign button
    if (isShs) {
      baseColumns.push({
        header: "Strand",
        accessorKey: "strandCode",
        cell: ({ row }) => {
          const hasStrand = !!row.original.strandCode;
          if (hasStrand) {
            return (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{row.original.strandCode}</Badge>
                {onCheckCanChangeStrand && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => handleOpenChangeStrand(row.original)}
                  >
                    Change
                  </Button>
                )}
              </div>
            );
          }
          // No strand - show prominent assign button
          return onCheckCanChangeStrand ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs border-warning text-warning hover:bg-warning-tint"
              onClick={() => handleOpenChangeStrand(row.original)}
            >
              <GitBranch className="mr-1 h-3 w-3" />
              Assign Strand
            </Button>
          ) : (
            <span className="text-muted-foreground italic text-sm">Not set</span>
          );
        },
      });

      // Add subjects column for SHS sections (strand-aware: core + strand-specific)
      baseColumns.push({
        header: "Subjects",
        accessorKey: "subjectCount",
        cell: ({ row }) => {
          const { subjectCount, subjectTotal } = row.original;
          if (subjectTotal === 0) {
            return <span className="text-muted-foreground text-sm">—</span>;
          }
          const isComplete = subjectCount >= subjectTotal;
          return (
            <Badge
              variant={isComplete ? "success" : "secondary"}
              className={cn(
                !isComplete && subjectCount > 0 && "bg-warning-tint text-warning"
              )}
            >
              {subjectCount}/{subjectTotal}
            </Badge>
          );
        },
      });
    }

    // Status column
    baseColumns.push({
      header: "Status",
      accessorKey: "enrollmentStatus",
      cell: ({ row }) => (
        <Badge variant="success">{row.original.enrollmentStatus}</Badge>
      ),
    });

    // Actions column for SHS with strand management (dropdown for additional actions)
    if (isShs && onCheckCanChangeStrand) {
      baseColumns.push({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleOpenChangeStrand(row.original)}
              >
                <GitBranch className="mr-2 h-4 w-4" />
                {row.original.strandCode ? "Change Strand" : "Assign Strand"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      });
    }

    return baseColumns;
  }, [isShs, onCheckCanChangeStrand]);

  return (
    <div className="space-y-4">
      {/* Warning banner for SHS sections with students missing strand */}
      {isShs && missingStrandCount > 0 && (
        <Alert variant="warning" className="border-warning/25 bg-warning-tint">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-warning">
              <strong>{missingStrandCount}</strong> student{missingStrandCount !== 1 ? "s" : ""} need{missingStrandCount === 1 ? "s" : ""} strand assignment.
              Students without a strand will not be enrolled in strand-specific elective subjects.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Bulk action bar */}
      {isShs && selectedWithoutStrand.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              <strong>{selectedWithoutStrand.length}</strong> student{selectedWithoutStrand.length !== 1 ? "s" : ""} selected without strand
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setShowBulkAssignDialog(true)}
            className="bg-warning hover:bg-warning"
          >
            <GitBranch className="mr-2 h-4 w-4" />
            Assign Strand to Selected
          </Button>
        </div>
      )}

      {students.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-muted-foreground mb-2">
            No enrolled students in this section
          </div>
          <p className="text-sm text-muted-foreground">
            Students will appear here once they are enrolled in this section.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={students}
          searchable
          searchPlaceholder="Search students..."
          rowSelection={isShs ? rowSelection : undefined}
          onRowSelectionChange={isShs ? setRowSelection : undefined}
          getRowClassName={
            isShs
              ? (row) =>
                  !row.original.strandCode
                    ? "bg-warning/10"
                    : ""
              : undefined
          }
        />
      )}

      {/* Change Strand Dialog */}
      {selectedStudent && strandInfo && !isLoadingStrandInfo && (
        <ChangeStrandDialog
          enrollmentId={selectedStudent.enrollmentId}
          studentName={`${selectedStudent.firstName} ${selectedStudent.lastName}`}
          strandInfo={strandInfo}
          availableStrands={availableStrands}
          open={!!selectedStudent}
          onOpenChange={handleCloseDialog}
        />
      )}

      {/* Bulk Strand Assignment Dialog */}
      {showBulkAssignDialog && (
        <BulkStrandAssignDialog
          enrollmentIds={selectedWithoutStrand.map((s) => s.enrollmentId)}
          studentCount={selectedWithoutStrand.length}
          availableStrands={availableStrands}
          open={showBulkAssignDialog}
          onOpenChange={handleCloseBulkDialog}
        />
      )}
    </div>
  );
}
