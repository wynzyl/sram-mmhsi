import {
  Skeleton,
  SkeletonStatCard,
  SkeletonTable,
  SkeletonFilterBar,
} from "@/components/ui/skeleton";

export default function StaffEnrollmentsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Tabs / Filter bar */}
      <SkeletonFilterBar tabs={5} />

      {/* Table */}
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
