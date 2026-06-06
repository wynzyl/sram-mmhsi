import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function NewAssessmentLoading() {
  return (
    <div className="page-container max-w-7xl flex flex-col gap-6">
      {/* Section header */}
      <div>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-full max-w-xl mb-1" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Student summary card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* Current charges (fee lines) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-5 w-40 mb-4" />
        <SkeletonTable rows={6} columns={4} />
      </div>

      {/* Discount requests + footer actions */}
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-5 w-44 mb-4" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  );
}
