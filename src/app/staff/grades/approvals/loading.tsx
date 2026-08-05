import { Skeleton } from "@/components/ui/skeleton";

export default function GradeApprovalsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72 mt-1" />
      </div>

      {/* Cards Grid - 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-xl border border-border shadow-sm p-6"
          >
            {/* Top row - badge and period */}
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>

            {/* Grade Level and Section */}
            <Skeleton className="h-6 w-24 mb-1" />
            <Skeleton className="h-4 w-20 mb-4" />

            {/* Details */}
            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>

            {/* Action link */}
            <div className="mt-4 pt-4 border-t border-border">
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
