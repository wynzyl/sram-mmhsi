"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, UserMinus, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import type { StudentSubjectEnrollmentView } from "../student-subject-enrollments.schema";
import { WithdrawSubjectDialog } from "./WithdrawSubjectDialog";
import { ManualSubjectEnrollDialog, type SubjectOfferingOption } from "./ManualSubjectEnrollDialog";

interface StudentSubjectsTableProps {
  enrollments: StudentSubjectEnrollmentView[];
  canManage: boolean;
  /** For manual enrollment: enrollment ID */
  enrollmentId?: string;
  /** For manual enrollment: student name */
  studentName?: string;
  /** For manual enrollment: student's strand code (for SHS) */
  studentStrandCode?: string | null;
  /** For manual enrollment: available subject offerings not yet enrolled */
  availableOfferings?: SubjectOfferingOption[];
  /** Whether to show the add elective button (SHS sections only) */
  showAddElective?: boolean;
}

export function StudentSubjectsTable({
  enrollments,
  canManage,
  enrollmentId,
  studentName,
  studentStrandCode,
  availableOfferings = [],
  showAddElective = false,
}: StudentSubjectsTableProps) {
  const [withdrawEnrollment, setWithdrawEnrollment] =
    useState<StudentSubjectEnrollmentView | null>(null);
  const [showManualEnrollDialog, setShowManualEnrollDialog] = useState(false);

  const activeEnrollments = enrollments.filter((e) => e.isActive);
  const withdrawnEnrollments = enrollments.filter((e) => !e.isActive);

  // Count electives for display
  const electiveCount = activeEnrollments.filter((e) => !e.isCore).length;

  return (
    <>
      <div className="space-y-6">
        {/* Active Subjects */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Active Subjects ({activeEnrollments.length})
              {electiveCount > 0 && (
                <span className="ml-1 text-xs">
                  ({electiveCount} elective{electiveCount !== 1 ? "s" : ""})
                </span>
              )}
            </h3>
            {showAddElective && canManage && enrollmentId && studentName && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowManualEnrollDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Subject
              </Button>
            )}
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[80px] text-center">Units</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead>Teacher</TableHead>
                  {canManage && <TableHead className="w-[70px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeEnrollments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManage ? 6 : 5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No subjects enrolled. Assign student to a section first.
                    </TableCell>
                  </TableRow>
                ) : (
                  activeEnrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>
                        <Badge variant="secondary">{enrollment.subjectCode}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{enrollment.subjectName}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        {enrollment.subjectUnits}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={enrollment.isCore ? "info" : "secondary"}
                        >
                          {enrollment.isCore ? "Core" : "Elective"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {enrollment.teacherName ? (
                          <span className="text-sm">{enrollment.teacherName}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            TBA
                          </span>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setWithdrawEnrollment(enrollment)}
                                className="text-destructive focus:text-destructive"
                              >
                                <UserMinus className="mr-2 h-4 w-4" />
                                Withdraw
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Withdrawn Subjects */}
        {withdrawnEnrollments.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Withdrawn Subjects ({withdrawnEnrollments.length})
            </h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Withdrawn</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawnEnrollments.map((enrollment) => (
                    <TableRow key={enrollment.id} className="opacity-60">
                      <TableCell>
                        <Badge variant="secondary">{enrollment.subjectCode}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{enrollment.subjectName}</div>
                      </TableCell>
                      <TableCell>
                        {enrollment.withdrawnAt
                          ? formatDate(enrollment.withdrawnAt)
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {enrollment.withdrawalReason || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Withdraw Dialog */}
      {withdrawEnrollment && (
        <WithdrawSubjectDialog
          enrollment={withdrawEnrollment}
          open={!!withdrawEnrollment}
          onOpenChange={(open) => !open && setWithdrawEnrollment(null)}
        />
      )}

      {/* Manual Enrollment Dialog */}
      {showManualEnrollDialog && enrollmentId && studentName && (
        <ManualSubjectEnrollDialog
          enrollmentId={enrollmentId}
          studentName={studentName}
          studentStrandCode={studentStrandCode ?? null}
          availableOfferings={availableOfferings}
          open={showManualEnrollDialog}
          onOpenChange={setShowManualEnrollDialog}
        />
      )}
    </>
  );
}
