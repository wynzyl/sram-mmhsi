import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors PortalPage's wrapper and header geometry so route-level loading
 * states resolve without shifting layout.
 */
export function PortalPageSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-4 sm:px-6 sm:py-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      {children}
    </div>
  );
}

/** Mirrors PortalSection: header bar, body, optional footer. */
export function PortalSectionSkeleton({
  children,
  footer = false,
}: {
  children: ReactNode;
  footer?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3 sm:px-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="p-4 sm:p-5">{children}</div>
      {footer ? (
        <div className="border-t border-border bg-muted/25 px-4 py-2.5 sm:px-5">
          <Skeleton className="h-3 w-64" />
        </div>
      ) : null}
    </div>
  );
}
