"use client";

import { cn } from "@/lib/utils/cn";
import type { CurriculumStatus } from "../curriculums.schema";
import { CURRICULUM_STATUS_LABELS } from "../curriculums.schema";

interface CurriculumStatusBadgeProps {
  status: CurriculumStatus;
  className?: string;
}

const STATUS_STYLES: Record<CurriculumStatus, string> = {
  draft: "bg-warning-tint text-warning",
  published: "bg-success-tint text-success",
  archived: "bg-muted text-muted-foreground",
};

export function CurriculumStatusBadge({ status, className }: CurriculumStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        STATUS_STYLES[status],
        className
      )}
    >
      {CURRICULUM_STATUS_LABELS[status]}
    </span>
  );
}
