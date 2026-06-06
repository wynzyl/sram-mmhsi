import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function StudentProfileLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header: name + reference + actions */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-64 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Profile info cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j}>
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* History table */}
      <SkeletonTable rows={5} columns={5} />
    </div>
  );
}
