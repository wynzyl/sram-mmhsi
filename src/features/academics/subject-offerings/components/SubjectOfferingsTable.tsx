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
import { MoreHorizontal, UserPlus, Trash2, Users, ArrowRightLeft } from "lucide-react";
import type { SubjectOfferingView, TeacherOption } from "../subject-offerings.schema";
import type { StrandOption } from "@/features/academics/strands/strands.schema";
import { AssignTeacherDialog } from "./AssignTeacherDialog";
import { DeleteOfferingDialog } from "./DeleteOfferingDialog";
import { ChangeTrackDialog } from "./ChangeTrackDialog";
import { TERM_OFFERING_LABELS } from "@/lib/constants/term-offerings";

interface SubjectOfferingsTableProps {
  offerings: SubjectOfferingView[];
  teachers: TeacherOption[];
  canAssignTeacher: boolean;
  canDelete: boolean;
  /** Whether to show the Term column (SHS sections only) */
  showTermColumn?: boolean;
  /** Available strands for track assignment (SHS only) */
  availableStrands?: StrandOption[];
  /** Whether user can change track assignment */
  canChangeTrack?: boolean;
}

export function SubjectOfferingsTable({
  offerings,
  teachers,
  canAssignTeacher,
  canDelete,
  showTermColumn = false,
  availableStrands = [],
  canChangeTrack = false,
}: SubjectOfferingsTableProps) {
  const [assignOffering, setAssignOffering] = useState<SubjectOfferingView | null>(null);
  const [deleteOffering, setDeleteOffering] = useState<SubjectOfferingView | null>(null);
  const [changeTrackOffering, setChangeTrackOffering] = useState<SubjectOfferingView | null>(null);

  // Show change track option only if user has permission and strands are available
  const showChangeTrack = canChangeTrack && availableStrands.length > 0;

  // Calculate column count for empty state
  const columnCount = 7 + (showTermColumn ? 1 : 0) + (canAssignTeacher || canDelete ? 1 : 0);

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-[80px] text-center">Units</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              {showTermColumn && <TableHead className="w-[120px]">Term</TableHead>}
              <TableHead>Teacher</TableHead>
              <TableHead className="w-[80px] text-center">Students</TableHead>
              <TableHead className="w-[80px] text-center">Status</TableHead>
              {(canAssignTeacher || canDelete || showChangeTrack) && <TableHead className="w-[70px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {offerings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  No subject offerings found. Generate offerings from the adopted curriculum.
                </TableCell>
              </TableRow>
            ) : (
              offerings.map((offering) => (
                <TableRow key={offering.id}>
                  <TableCell>
                    <Badge variant="secondary">{offering.subjectCode}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{offering.subjectName}</div>
                    {offering.strandCode && (
                      <div className="text-xs text-muted-foreground">
                        {offering.strandCode} only
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {offering.subjectUnits}
                  </TableCell>
                  <TableCell>
                    <Badge variant={offering.isCore ? "info" : "secondary"}>
                      {offering.isCore ? "Core" : "Elective"}
                    </Badge>
                  </TableCell>
                  {showTermColumn && (
                    <TableCell>
                      <span className="text-sm">
                        {TERM_OFFERING_LABELS[offering.termOffered] || "Full Year"}
                      </span>
                    </TableCell>
                  )}
                  <TableCell>
                    {offering.teacherName ? (
                      <span className="text-sm">{offering.teacherName}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">
                        Not assigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {offering.studentCount ?? 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {offering.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  {(canAssignTeacher || canDelete || showChangeTrack) && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canAssignTeacher && (
                            <DropdownMenuItem
                              onClick={() => setAssignOffering(offering)}
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              {offering.teacherId ? "Change Teacher" : "Assign Teacher"}
                            </DropdownMenuItem>
                          )}
                          {showChangeTrack && (
                            <DropdownMenuItem
                              onClick={() => setChangeTrackOffering(offering)}
                            >
                              <ArrowRightLeft className="mr-2 h-4 w-4" />
                              Change Track
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              onClick={() => setDeleteOffering(offering)}
                              className="text-destructive focus:text-destructive"
                              disabled={(offering.studentCount ?? 0) > 0}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
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

      {/* Assign Teacher Dialog */}
      {assignOffering && (
        <AssignTeacherDialog
          offering={assignOffering}
          teachers={teachers}
          open={!!assignOffering}
          onOpenChange={(open) => !open && setAssignOffering(null)}
        />
      )}

      {/* Delete Dialog */}
      {deleteOffering && (
        <DeleteOfferingDialog
          offering={deleteOffering}
          open={!!deleteOffering}
          onOpenChange={(open) => !open && setDeleteOffering(null)}
        />
      )}

      {/* Change Track Dialog */}
      {changeTrackOffering && (
        <ChangeTrackDialog
          offering={changeTrackOffering}
          availableStrands={availableStrands}
          open={!!changeTrackOffering}
          onOpenChange={(open) => !open && setChangeTrackOffering(null)}
        />
      )}
    </>
  );
}
