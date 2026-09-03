"use client";

import Link from "next/link";
import { Eye, MoreHorizontal, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Kebab actions for a student row — used on Students and Registrations lists */
export function StudentRowActionsMenu({
  studentRef,
  studentId,
  studentBasePath = "/staff/students",
}: {
  /** Student reference number (e.g., "0000001") - used for route paths */
  studentRef: string;
  /** Student UUID - used for query parameters */
  studentId: string;
  studentBasePath?: "/admin/students" | "/staff/students";
}) {
  const enrollBase = studentBasePath.startsWith("/admin")
    ? "/admin/enrollments/new"
    : "/staff/enrollments/new";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Row actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem asChild>
          <Link href={`${studentBasePath}/${studentRef}`} prefetch={false}>
            <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
            View Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${studentBasePath}/${studentRef}/edit`} prefetch={false}>
            <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="text-primary focus:text-primary">
          <Link href={`${enrollBase}?studentId=${studentId}`} prefetch={false}>
            <UserPlus className="mr-2 h-4 w-4" />
            Enroll
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
