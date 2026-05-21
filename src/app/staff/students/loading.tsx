import {
  Skeleton,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function StaffStudentsLoading() {
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

      {/* Search/Filter bar */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Table */}
      <SkeletonTable rows={10} columns={7} />
    </div>
  );
}
