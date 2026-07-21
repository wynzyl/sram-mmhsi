"use client";

import Link from "next/link";
import {
  QUARTERLY_PERIODS,
  TRIMESTER_PERIODS,
  GRADING_PERIOD_LABELS,
  type GradingPeriod,
} from "@/lib/constants/grading-periods";
import type { GradingSystemType } from "@/lib/constants/grading-systems";
import type { PeriodCompletionStatus } from "../grades.queries";

interface GradingPeriodSelectorProps {
  sectionId: string;
  selectedPeriod: string;
  systemType: GradingSystemType;
  completionStatus: Record<string, PeriodCompletionStatus>;
}

export function GradingPeriodSelector({
  sectionId,
  selectedPeriod,
  systemType,
  completionStatus,
}: GradingPeriodSelectorProps) {
  // Get the appropriate periods based on system type
  const periods = systemType === "trimester" ? TRIMESTER_PERIODS : QUARTERLY_PERIODS;

  // Determine which periods are accessible
  const getIsLocked = (periodIndex: number): boolean => {
    if (periodIndex === 0) return false; // First period is always accessible
    const prevPeriod = periods[periodIndex - 1];
    const prevStatus = completionStatus[prevPeriod];
    return !prevStatus?.isComplete; // Previous period must be approved/published
  };

  // Get lock reason for tooltip
  const getLockReason = (periodIndex: number): string => {
    if (periodIndex === 0) return "";
    const prevPeriod = periods[periodIndex - 1];
    const prevStatus = completionStatus[prevPeriod];

    if (!prevStatus?.hasGradeSheet) {
      return `${GRADING_PERIOD_LABELS[prevPeriod as GradingPeriod]} has not been started`;
    }

    if (prevStatus.status === "submitted") {
      return `${GRADING_PERIOD_LABELS[prevPeriod as GradingPeriod]} is awaiting principal approval`;
    }

    if (prevStatus.status === "draft" || prevStatus.status === "returned") {
      return `${GRADING_PERIOD_LABELS[prevPeriod as GradingPeriod]} must be submitted and approved first`;
    }

    return "Previous period must be approved first";
  };

  // Get status indicator for a period
  const getStatusIndicator = (status: PeriodCompletionStatus | undefined) => {
    if (!status?.hasGradeSheet) return null;

    if (status.isComplete) {
      // Published/Approved - green checkmark
      return (
        <span title="Published">
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    }

    if (status.status === "submitted") {
      // Awaiting approval - clock icon
      return (
        <span title="Awaiting Approval">
          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      );
    }

    if (status.status === "returned") {
      // Returned for revision - warning icon
      return (
        <span title="Returned for Revision">
          <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </span>
      );
    }

    return null;
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm">
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8 px-6" aria-label="Grading Periods">
          {periods.map((period, index) => {
            const isActive = selectedPeriod === period;
            const isLocked = getIsLocked(index);
            const status = completionStatus[period];

            if (isLocked) {
              return (
                <span
                  key={period}
                  className="whitespace-nowrap py-4 px-1 border-b-2 border-transparent font-medium text-sm text-muted-foreground/50 cursor-not-allowed flex items-center gap-1"
                  title={getLockReason(index)}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  {GRADING_PERIOD_LABELS[period as GradingPeriod]}
                </span>
              );
            }

            return (
              <Link
                key={period}
                href={`/staff/grades/sections/${sectionId}?period=${period}`}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-1
                  ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }
                `}
              >
                {GRADING_PERIOD_LABELS[period as GradingPeriod]}
                {getStatusIndicator(status)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
