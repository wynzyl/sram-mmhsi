import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface PortalSectionProps {
  title: string;
  subtitle?: ReactNode;
  /** Status chip aligned to the right of the header bar. */
  badge?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  /** Set false when the body supplies its own padding, e.g. a full-bleed table. */
  padded?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Bordered content card used across the portal.
 *
 * Matches the staff app's section chrome so the two halves of the product read
 * as one system. Radius is locked to rounded-lg (= var(--radius)) rather than
 * the Card primitive's rounded-xl, which keeps portal surfaces internally
 * consistent without restyling the shared primitive.
 */
export function PortalSection({
  title,
  subtitle,
  badge,
  actions,
  footer,
  padded = true,
  className,
  children,
}: PortalSectionProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-2 border-b border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0 space-y-0.5">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {badge || actions ? (
          <div className="flex shrink-0 items-center gap-2">
            {badge}
            {actions}
          </div>
        ) : null}
      </div>

      <div className={cn(padded && "p-4 sm:p-5")}>{children}</div>

      {footer ? (
        <div className="border-t border-border bg-muted/25 px-4 py-2.5 text-sm sm:px-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
