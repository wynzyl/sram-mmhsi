import {
  Skeleton,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function SectionsLoading() {
  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Card with Table */}
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>

        {/* Table */}
        <SkeletonTable rows={10} columns={6} />
      </section>
    </div>
  );
}
