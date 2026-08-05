import {
  Skeleton,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function CoordinatorsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-7 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Card with Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <SkeletonTable rows={6} columns={5} />
      </div>
    </div>
  );
}
