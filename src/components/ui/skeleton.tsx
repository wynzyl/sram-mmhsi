import { cn } from "@/lib/utils/cn";

/**
 * Skeleton loading placeholder component.
 * Use these primitives to create loading states that match your UI layout.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    />
  );
}

/**
 * Skeleton variant for text lines.
 */
export function SkeletonText({
  className,
  lines = 1,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 && lines > 1 ? "w-3/4" : "w-full")}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton variant for stat cards (dashboard metrics).
 */
export function SkeletonStatCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "p-4 rounded-xl border border-border bg-card",
        className
      )}
      {...props}
    >
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

/**
 * Skeleton variant for table rows.
 */
export function SkeletonTableRow({
  columns = 5,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { columns?: number }) {
  return (
    <div
      className={cn("flex items-center gap-4 p-4 border-b border-border", className)}
      {...props}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4 flex-1", i === 0 && "w-24 flex-none")} />
      ))}
    </div>
  );
}

/**
 * Skeleton variant for full table with header.
 */
export function SkeletonTable({
  rows = 5,
  columns = 5,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { rows?: number; columns?: number }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-card border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={cn("h-4 flex-1", i === 0 && "w-24 flex-none")} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </div>
  );
}

/**
 * Skeleton for page headers with title and optional actions.
 */
export function SkeletonPageHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between", className)} {...props}>
      <div>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
  );
}

/**
 * Skeleton for filter bar with tabs.
 */
export function SkeletonFilterBar({
  tabs = 4,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tabs?: number }) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {Array.from({ length: tabs }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-md" />
      ))}
    </div>
  );
}
