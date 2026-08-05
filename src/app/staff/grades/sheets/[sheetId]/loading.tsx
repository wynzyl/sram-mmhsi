import { Skeleton } from "@/components/ui/skeleton";

export default function GradeSheetReviewLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header Card */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-2" />
              <Skeleton className="h-4 w-20" />
            </div>
            {/* Title */}
            <Skeleton className="h-8 w-72" />
            {/* Subtitle */}
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>

        {/* Meta Info Grid */}
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* Grade Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3">
                  <Skeleton className="h-4 w-28" />
                </th>
                {Array.from({ length: 10 }).map((_, i) => (
                  <th key={i} className="px-3 py-3 text-center">
                    <Skeleton className="h-4 w-10 mx-auto" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }).map((_, rowIdx) => (
                <tr key={rowIdx} className="border-b border-border">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-20 mt-1" />
                  </td>
                  {Array.from({ length: 10 }).map((_, colIdx) => (
                    <td key={colIdx} className="px-3 py-3 text-center">
                      <Skeleton className="h-4 w-8 mx-auto" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="border-t border-border p-4 bg-muted">
          <Skeleton className="h-4 w-24 mb-2" />
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-32" />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
    </div>
  );
}
