import {
  Skeleton,
  SkeletonStatCard,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function SectionDetailLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Back Button */}
      <Skeleton className="h-9 w-36 rounded-md" />

      {/* Section Info */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-48 mt-1" />
        </div>
      </div>

      {/* Stats Grid - 4 cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Subject Offerings Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
        </div>
        <SkeletonTable rows={6} columns={5} />
      </div>

      {/* Students Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 mt-1" />
        </div>
        <SkeletonTable rows={8} columns={5} />
      </div>
    </div>
  );
}
