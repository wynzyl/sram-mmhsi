"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface SpedBadgeProps {
  isSped: boolean;
  className?: string;
}

/**
 * Displays a small "SPED" badge for Special Education students.
 * Only renders when isSped is true.
 *
 * @example
 * <span className="flex items-center gap-1">
 *   {studentName}
 *   <SpedBadge isSped={student.isSpecialEducation} />
 * </span>
 */
export function SpedBadge({ isSped, className }: SpedBadgeProps) {
  if (!isSped) return null;

  return (
    <Badge
      variant="info"
      className={cn("ml-1.5 h-4 min-h-4 px-1.5 py-0 text-[10px]", className)}
    >
      SPED
    </Badge>
  );
}
