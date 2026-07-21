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
    return !prevStatus?.isComplete;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6" aria-label="Grading Periods">
          {periods.map((period, index) => {
            const isActive = selectedPeriod === period;
            const isLocked = getIsLocked(index);
            const status = completionStatus[period];
            const isComplete = status?.isComplete;

            if (isLocked) {
              return (
                <span
                  key={period}
                  className="whitespace-nowrap py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-300 cursor-not-allowed flex items-center gap-1"
                  title="Complete the previous period first"
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
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                {GRADING_PERIOD_LABELS[period as GradingPeriod]}
                {isComplete && (
                  <span title="Complete">
                    <svg
                      className="h-4 w-4 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
