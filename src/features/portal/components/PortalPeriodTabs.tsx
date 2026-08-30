"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface PortalPeriodTabsProps {
  tabs: { id: string; label: string }[];
  /** Pre-rendered panels, same order and length as `tabs`. */
  children: ReactNode[];
  ariaLabel: string;
}

/**
 * Accessible tab strip used on narrow viewports only.
 *
 * Panels arrive already rendered from the server, so no grade data crosses the
 * client boundary and the client bundle stays tiny. Implements the WAI-ARIA
 * tabs pattern with automatic activation and roving tabindex.
 */
export function PortalPeriodTabs({
  tabs,
  children,
  ariaLabel,
}: PortalPeriodTabsProps) {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (tabs.length === 0) return null;

  const focusTab = (index: number) => {
    setActive(index);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusTab(index === last ? 0 : index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusTab(index === 0 ? last : index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(last);
        break;
      default:
        break;
    }
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab, index) => {
          const selected = index === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-controls={`${baseId}-panel-${tab.id}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "min-h-11 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          tabIndex={0}
          hidden={index !== active}
          className="pt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children[index]}
        </div>
      ))}
    </div>
  );
}
