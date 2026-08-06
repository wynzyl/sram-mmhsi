"use client";

import { useState, useCallback, useEffect } from "react";
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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { TRACK_CATEGORY_SHORT_LABELS } from "@/lib/constants/track-categories";
import type { StrandView } from "../strands.schema";
import { StrandFormDialog } from "./StrandFormDialog";
import { DeleteStrandDialog } from "./DeleteStrandDialog";

interface StrandsTableProps {
  strands: StrandView[];
  canManage: boolean;
}

export function StrandsTable({ strands, canManage }: StrandsTableProps) {
  const [editStrand, setEditStrand] = useState<StrandView | null>(null);
  const [deleteStrand, setDeleteStrand] = useState<StrandView | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Handle edit dialog open/close with proper cleanup
  const handleEditClick = useCallback((strand: StrandView) => {
    setEditStrand(strand);
    setEditDialogOpen(true);
  }, []);

  const handleEditDialogChange = useCallback((open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      // Delay clearing strand data to allow Radix animation to complete
      setTimeout(() => setEditStrand(null), 200);
    }
  }, []);

  // Handle delete dialog open/close with proper cleanup
  const handleDeleteClick = useCallback((strand: StrandView) => {
    setDeleteStrand(strand);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      // Delay clearing strand data to allow Radix animation to complete
      setTimeout(() => setDeleteStrand(null), 200);
    }
  }, []);

  // Force cleanup of pointer-events when any dialog closes
  useEffect(() => {
    if (!editDialogOpen && !deleteDialogOpen) {
      // Multiple cleanup attempts to ensure pointer-events is restored
      const cleanup = () => {
        document.body.style.pointerEvents = "";
        document.body.style.removeProperty("pointer-events");
      };
      cleanup();
      const t1 = setTimeout(cleanup, 100);
      const t2 = setTimeout(cleanup, 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [editDialogOpen, deleteDialogOpen]);

  // Helper to get category badge variant
  const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
      case "academic":
        return "info";
      case "tvl":
        return "warning";
      case "specialized":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px]">Category</TableHead>
              <TableHead className="w-[80px] text-center">Subjects</TableHead>
              <TableHead className="w-[80px] text-center">Sections</TableHead>
              <TableHead className="w-[80px] text-center">Enrollments</TableHead>
              <TableHead className="w-[80px] text-center">Status</TableHead>
              <TableHead className="w-[50px]">Order</TableHead>
              {canManage && <TableHead className="w-[70px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {strands.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 9 : 8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No tracks found. Add tracks to enable SHS track-based curriculum.
                </TableCell>
              </TableRow>
            ) : (
              strands.map((strand) => (
                <TableRow key={strand.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <Badge variant="secondary">{strand.shortCode}</Badge>
                      {strand.shortCode !== strand.code && (
                        <span className="text-xs text-muted-foreground">
                          {strand.code}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{strand.name}</div>
                    {strand.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {strand.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getCategoryBadgeVariant(strand.trackCategory)}>
                      {TRACK_CATEGORY_SHORT_LABELS[strand.trackCategory] ?? strand.trackCategory}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {strand.subjectCount ?? 0}
                  </TableCell>
                  <TableCell className="text-center">
                    {strand.sectionCount ?? 0}
                  </TableCell>
                  <TableCell className="text-center">
                    {strand.enrollmentCount ?? 0}
                  </TableCell>
                  <TableCell className="text-center">
                    {strand.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {strand.displayOrder}
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
                            onClick={() => handleEditClick(strand)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(strand)}
                            className="text-destructive focus:text-destructive"
                            disabled={
                              (strand.subjectCount ?? 0) > 0 ||
                              (strand.sectionCount ?? 0) > 0 ||
                              (strand.enrollmentCount ?? 0) > 0
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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

      {/* Edit Dialog - use controlled open state for proper Radix cleanup */}
      {editStrand && (
        <StrandFormDialog
          strand={editStrand}
          open={editDialogOpen}
          onOpenChange={handleEditDialogChange}
        />
      )}

      {/* Delete Dialog - use controlled open state for proper Radix cleanup */}
      {deleteStrand && (
        <DeleteStrandDialog
          strand={deleteStrand}
          open={deleteDialogOpen}
          onOpenChange={handleDeleteDialogChange}
        />
      )}
    </>
  );
}
