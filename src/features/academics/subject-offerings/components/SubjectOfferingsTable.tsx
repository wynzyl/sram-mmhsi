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
import { MoreHorizontal, UserPlus, Trash2, Users } from "lucide-react";
import type { SubjectOfferingView, TeacherOption } from "../subject-offerings.schema";
import { AssignTeacherDialog } from "./AssignTeacherDialog";
import { DeleteOfferingDialog } from "./DeleteOfferingDialog";

interface SubjectOfferingsTableProps {
  offerings: SubjectOfferingView[];
  teachers: TeacherOption[];
  canAssignTeacher: boolean;
  canDelete: boolean;
}

export function SubjectOfferingsTable({
  offerings,
  teachers,
  canAssignTeacher,
  canDelete,
}: SubjectOfferingsTableProps) {
  const [assignOffering, setAssignOffering] = useState<SubjectOfferingView | null>(null);
  const [deleteOffering, setDeleteOffering] = useState<SubjectOfferingView | null>(null);

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
              <TableHead>Teacher</TableHead>
              <TableHead className="w-[80px] text-center">Students</TableHead>
              <TableHead className="w-[80px] text-center">Status</TableHead>
              {(canAssignTeacher || canDelete) && <TableHead className="w-[70px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {offerings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canAssignTeacher || canDelete ? 8 : 7}
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
                  {(canAssignTeacher || canDelete) && (
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
    </>
  );
}
