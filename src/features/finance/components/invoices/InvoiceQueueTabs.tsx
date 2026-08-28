"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { InvoiceTabKey, InvoiceTabCounts } from "../../invoices/invoices.queries";

type InvoiceQueueTabsProps = {
  counts: InvoiceTabCounts;
  currentTab: InvoiceTabKey;
  basePath: string;
};

const TAB_CONFIG: Array<{ key: InvoiceTabKey; label: string }> = [
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "viewed", label: "Viewed" },
  { key: "overdue", label: "Overdue" },
];

/**
 * Tab navigation for Invoice Queue.
 * Displays status tabs with counts as badges.
 */
export default function InvoiceQueueTabs({
  counts,
  currentTab,
  basePath,
}: InvoiceQueueTabsProps) {
  const searchParams = useSearchParams();

  /**
   * Build tab href preserving other search params
   */
  function getTabHref(tab: InvoiceTabKey): string {
    const params = new URLSearchParams();
    params.set("tab", tab);
    // Preserve search and grade level filters when switching tabs
    const search = searchParams.get("search");
    const gradeLevel = searchParams.get("gradeLevel");
    if (search) params.set("search", search);
    if (gradeLevel) params.set("gradeLevel", gradeLevel);
    return `${basePath}?${params.toString()}`;
  }

  function getCount(tab: InvoiceTabKey): number {
    return counts[tab];
  }

  return (
    <div className="border-b border-border">
      <nav className="flex overflow-x-auto px-4" aria-label="Invoice status tabs">
        {TAB_CONFIG.map(({ key, label }) => {
          const isActive = currentTab === key;
          const count = getCount(key);

          return (
            <Link
              key={key}
              href={getTabHref(key)}
              className={`
                relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                ${
                  isActive
                    ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="uppercase tracking-wide">{label}</span>
              <span
                className={`
                  inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-semibold
                  ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }
                `}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
