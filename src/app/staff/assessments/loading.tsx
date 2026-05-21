import {
  Skeleton,
  SkeletonTable,
  SkeletonFilterBar,
} from "@/components/ui/skeleton";

export default function StaffAssessmentsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-36 mb-2" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-64 rounded-md" />
        <SkeletonFilterBar tabs={3} />
      </div>

      {/* Table */}
      <SkeletonTable rows={10} columns={6} />
    </div>
  );
}
