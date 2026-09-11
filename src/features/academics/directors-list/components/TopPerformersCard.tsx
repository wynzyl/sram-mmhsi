"use client";

import Link from "next/link";
import { Award, ChevronRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DirectorsListEntry } from "../directors-list.schema";
import { DirectorsListBadge } from "./DirectorsListBadge";

interface TopPerformersCardProps {
  /** Top performing students (max 5 recommended) */
  performers: DirectorsListEntry[];
  /** School year label for display */
  schoolYearLabel: string;
  /** Grading period label for display */
  gradingPeriodLabel: string;
  /** Link to full Director's List page */
  viewAllHref?: string;
  /** Optional className */
  className?: string;
}

/**
 * Dashboard widget showing top performers from Director's List.
 * Displays top 5 students with highest GWA.
 */
export function TopPerformersCard({
  performers,
  schoolYearLabel,
  gradingPeriodLabel,
  viewAllHref = "/staff/grades/directors-list",
  className,
}: TopPerformersCardProps) {
  const hasPerformers = performers.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
            <Trophy className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Director&apos;s List</h3>
            <p className="text-xs text-muted-foreground">
              {gradingPeriodLabel} · {schoolYearLabel}
            </p>
          </div>
        </div>
        {hasPerformers && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View All
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {!hasPerformers ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Award className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              No qualifying students yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Grades may not be published for this period
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {performers.map((entry, index) => (
              <TopPerformerRow key={entry.studentId} entry={entry} rank={index + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TopPerformerRowProps {
  entry: DirectorsListEntry;
  rank: number;
}

function TopPerformerRow({ entry, rank }: TopPerformerRowProps) {
  const getRankStyle = (r: number) => {
    switch (r) {
      case 1:
        return "bg-amber-500 text-white";
      case 2:
        return "bg-slate-400 text-white";
      case 3:
        return "bg-amber-700 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors">
      {/* Rank Badge */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          getRankStyle(rank)
        )}
      >
        {rank}
      </div>

      {/* Student Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">
          {entry.studentName}
        </p>
        <p className="text-xs text-muted-foreground">
          {entry.gradeLevelName} - {entry.sectionName}
        </p>
      </div>

      {/* GWA */}
      <div className="text-right shrink-0">
        <p className="font-bold text-sm tabular-nums text-primary">
          {entry.gwa.toFixed(2)}
        </p>
        <DirectorsListBadge
          gwa={entry.gwa}
          gradeGroup={entry.gradeGroup}
          size="sm"
          showIcon={false}
        />
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for TopPerformersCard.
 */
export function TopPerformersCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm",
        className
      )}
    >
      {/* Header Skeleton */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-20 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-5 w-12 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
