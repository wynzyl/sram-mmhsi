"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils/cn";

type TabKey = "ready-to-enroll" | "pending" | "assessed" | "enrolled" | "cancelled";

export type TabCounts = {
  readyToEnroll: number;
  pending: number;
  assessed: number;
  enrolled: number;
  cancelled: number;
};

type TabConfig = {
  key: TabKey;
  label: string;
  countKey: keyof TabCounts;
  description: string;
};

const TABS: TabConfig[] = [
  {
    key: "ready-to-enroll",
    label: "Ready to Enroll",
    countKey: "readyToEnroll",
    description: "Students eligible for enrollment confirmation",
  },
  {
    key: "pending",
    label: "Pending",
    countKey: "pending",
    description: "Enrollments awaiting assessment",
  },
  {
    key: "assessed",
    label: "Assessed",
    countKey: "assessed",
    description: "Assessed, awaiting payment",
  },
  {
    key: "enrolled",
    label: "Enrolled",
    countKey: "enrolled",
    description: "Fully enrolled students",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    countKey: "cancelled",
    description: "Cancelled enrollments",
  },
];

type EnrollmentQueueTabsProps = {
  counts: TabCounts;
  currentTab: TabKey;
  basePath: string; // e.g., "/staff/enrollments"
};

export default function EnrollmentQueueTabs({ counts, currentTab, basePath }: EnrollmentQueueTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleTabChange = (tabKey: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabKey);
    // Use startTransition for smooth navigation with loading state
    startTransition(() => {
      // Push to new URL and refresh to ensure fresh server data
      router.push(`${basePath}?${params.toString()}`);
      router.refresh();
    });
  };

  return (
    <div className="border-b border-[var(--color-border)]">
      <nav className={cn("-mb-px flex gap-1", isPending && "opacity-70")} aria-label="Enrollment tabs">
        {TABS.map((tab) => {
          const isActive = currentTab === tab.key;
          const count = counts[tab.countKey];

          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              disabled={isPending}
              className={cn(
                "group relative inline-flex items-center gap-2 border-b-2 px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide transition-all duration-150",
                isActive
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:border-[var(--color-border-2)] hover:text-[var(--color-text)]",
                isPending && "cursor-wait"
              )}
              aria-current={isActive ? "page" : undefined}
              title={tab.description}
            >
              <span>{tab.label}</span>

              {/* Badge count */}
              <span
                className={cn(
                  "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-bold transition-colors duration-150",
                  isActive
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)] group-hover:bg-[var(--color-surface-4)] group-hover:text-[var(--color-text)]"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Get the current tab from URL search params
 */
export function getCurrentTab(searchParams: URLSearchParams): TabKey {
  const tab = searchParams.get("tab");

  if (
    tab === "ready-to-enroll" ||
    tab === "pending" ||
    tab === "assessed" ||
    tab === "enrolled" ||
    tab === "cancelled"
  ) {
    return tab;
  }

  // Default to "ready-to-enroll"
  return "ready-to-enroll";
}
