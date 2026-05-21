import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function AssessmentDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Header Card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Assessment Items */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <Skeleton className="h-5 w-32 mb-4" />
          <SkeletonTable rows={6} columns={3} />
        </div>

        {/* Payment History */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <Skeleton className="h-5 w-32 mb-4" />
          <SkeletonTable rows={4} columns={4} />
        </div>
      </div>
    </div>
  );
}
