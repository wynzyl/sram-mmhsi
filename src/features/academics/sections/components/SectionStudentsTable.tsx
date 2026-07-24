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
import { MoreHorizontal, GitBranch } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { StrandOption } from "@/features/academics/strands";
import type { CanChangeStrandResult } from "@/features/academics/student-subject-enrollments";
import { ChangeStrandDialog } from "@/features/academics/student-subject-enrollments";

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

  const columns = useMemo<ColumnDef<StudentInSection>[]>(() => {
    const baseColumns: ColumnDef<StudentInSection>[] = [
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
      },
    ];

    // Add strand column for SHS sections
    if (isShs) {
      baseColumns.push({
        header: "Strand",
        accessorKey: "strandCode",
        cell: ({ row }) => (
          row.original.strandCode ? (
            <Badge variant="secondary">{row.original.strandCode}</Badge>
          ) : (
            <span className="text-muted-foreground italic text-sm">Not set</span>
          )
        ),
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

    // Actions column for SHS with strand management
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
    <div>
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
    </div>
  );
}
