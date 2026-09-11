"use client";

import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { GradeGroup } from "@/lib/constants/grade-groups";
import {
  getDirectorsListThreshold,
  getAcademicLevelLabel,
} from "../directors-list.types";

interface DirectorsListBadgeProps {
  /** The student's GWA */
  gwa: number;
  /** Grade group for threshold lookup */
  gradeGroup: GradeGroup;
  /** Whether to show the trophy icon */
  showIcon?: boolean;
  /** Optional additional className */
  className?: string;
  /** Size variant */
  size?: "sm" | "default";
}

/**
 * Badge component indicating Director's List qualification.
 * Shows different styling based on how much above threshold the GWA is.
 */
export function DirectorsListBadge({
  gwa,
  gradeGroup,
  showIcon = true,
  className,
  size = "default",
}: DirectorsListBadgeProps) {
  const threshold = getDirectorsListThreshold(gradeGroup);
  const qualifies = gwa >= threshold;

  if (!qualifies) return null;

  // Determine excellence level based on how far above threshold
  const above = gwa - threshold;
  const variant = "success" as const;

  let label: string;
  if (above >= 6) {
    // 98+ for 92 threshold, 96+ for 90 threshold
    label = "With Highest Honors";
  } else if (above >= 3) {
    // 95+ for 92 threshold, 93+ for 90 threshold
    label = "With High Honors";
  } else {
    // At or just above threshold
    label = "With Honors";
  }

  return (
    <Badge
      variant={variant}
      className={cn(
        "gap-1",
        size === "sm" && "text-[10px] px-1.5 py-0",
        className
      )}
    >
      {showIcon && <Award className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />}
      <span>{label}</span>
    </Badge>
  );
}

interface DirectorsListIndicatorProps {
  /** The rank within the section/grade level */
  rank: number;
  /** The student's GWA */
  gwa: number;
  /** Optional className */
  className?: string;
}

/**
 * Compact indicator showing rank and GWA.
 * Used in table cells.
 */
export function DirectorsListIndicator({
  rank,
  gwa,
  className,
}: DirectorsListIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 bg-primary/10 text-primary text-sm font-semibold rounded">
        #{rank}
      </span>
      <span className="text-sm font-medium tabular-nums">{gwa.toFixed(2)}</span>
    </div>
  );
}

interface ThresholdInfoProps {
  /** Grade group to show threshold for */
  gradeGroup: GradeGroup;
  /** Optional className */
  className?: string;
}

/**
 * Displays the Director's List threshold for a grade level.
 */
export function ThresholdInfo({ gradeGroup, className }: ThresholdInfoProps) {
  const threshold = getDirectorsListThreshold(gradeGroup);
  const levelLabel = getAcademicLevelLabel(gradeGroup);

  return (
    <div className={cn("text-xs text-muted-foreground", className)}>
      {levelLabel}: {threshold}+ GWA required
    </div>
  );
}
