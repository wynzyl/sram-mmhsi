import {
  Skeleton,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function StrandsLoading() {
  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Card with Embedded Controls */}
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {/* Card Header with gradient effect */}
        <div className="card-header-gradient flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Title + Stats Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* Right: Controls */}
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>

        {/* Table Content */}
        <SkeletonTable rows={8} columns={5} />
      </section>
    </div>
  );
}
