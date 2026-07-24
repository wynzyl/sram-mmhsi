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
import { MoreHorizontal, UserMinus } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import type { StudentSubjectEnrollmentView } from "../student-subject-enrollments.schema";
import { WithdrawSubjectDialog } from "./WithdrawSubjectDialog";

interface StudentSubjectsTableProps {
  enrollments: StudentSubjectEnrollmentView[];
  canManage: boolean;
}

export function StudentSubjectsTable({
  enrollments,
  canManage,
}: StudentSubjectsTableProps) {
  const [withdrawEnrollment, setWithdrawEnrollment] =
    useState<StudentSubjectEnrollmentView | null>(null);

  const activeEnrollments = enrollments.filter((e) => e.isActive);
  const withdrawnEnrollments = enrollments.filter((e) => !e.isActive);

  return (
    <>
      <div className="space-y-6">
        {/* Active Subjects */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Active Subjects ({activeEnrollments.length})
          </h3>
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
    </>
  );
}
