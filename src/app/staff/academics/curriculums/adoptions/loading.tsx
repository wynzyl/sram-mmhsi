import { Skeleton } from "@/components/ui/skeleton";

export default function CurriculumAdoptionsLoading() {
  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Adoption Matrix Card */}
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-9 w-48 rounded-md" />
        </div>

        {/* Matrix Grid */}
        <div className="p-4">
          <div className="grid grid-cols-4 gap-4">
            {/* Header row */}
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />

            {/* Data rows */}
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
