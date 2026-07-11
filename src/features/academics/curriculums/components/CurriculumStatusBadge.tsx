"use client";

import { cn } from "@/lib/utils/cn";
import type { CurriculumStatus } from "../curriculums.schema";
import { CURRICULUM_STATUS_LABELS } from "../curriculums.schema";

interface CurriculumStatusBadgeProps {
  status: CurriculumStatus;
  className?: string;
}

const STATUS_STYLES: Record<CurriculumStatus, string> = {
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  archived: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
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
