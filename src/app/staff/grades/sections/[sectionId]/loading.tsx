import { Skeleton } from "@/components/ui/skeleton";

export default function GradeSectionLoading() {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-2" />
              <Skeleton className="h-4 w-20" />
            </div>
            {/* Title */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
            {/* Subtitle */}
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-20 rounded-md" />
            ))}
          </div>
        </div>
      </div>

      {/* Grade Entry Grid */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3">
                  <Skeleton className="h-4 w-28" />
                </th>
                {Array.from({ length: 8 }).map((_, i) => (
                  <th key={i} className="px-3 py-3 text-center">
                    <Skeleton className="h-4 w-12 mx-auto" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, rowIdx) => (
                <tr key={rowIdx} className="border-b border-border">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-20 mt-1" />
                  </td>
                  {Array.from({ length: 8 }).map((_, colIdx) => (
                    <td key={colIdx} className="px-3 py-3 text-center">
                      <Skeleton className="h-8 w-14 mx-auto rounded" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
