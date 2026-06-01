export default function PaymentCollectionReportLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex items-start justify-between">
        <div>
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-4 w-80 bg-muted rounded mt-2" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-muted rounded" />
          <div className="h-10 w-28 bg-muted rounded" />
        </div>
      </div>

      {/* Filters Skeleton */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-card border border-border rounded-lg">
        <div className="space-y-2">
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-10 w-40 bg-muted rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-10 w-40 bg-muted rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-10 w-36 bg-muted rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="h-10 w-36 bg-muted rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-10 w-32 bg-muted rounded" />
        </div>
        <div className="flex gap-2 self-end">
          <div className="h-10 w-28 bg-muted rounded" />
          <div className="h-10 w-20 bg-muted rounded" />
        </div>
      </div>

      {/* Report Preview Skeleton */}
      <div className="bg-white rounded-lg shadow-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b-2 border-border">
          <div className="flex justify-between">
            <div>
              <div className="h-7 w-64 bg-muted rounded" />
              <div className="h-4 w-96 bg-muted rounded mt-2" />
            </div>
            <div className="text-right space-y-2">
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-4 w-40 bg-muted rounded" />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="px-8 py-6 bg-gray-50 border-b border-border">
          <div className="h-5 w-24 bg-muted rounded mb-4" />
          <div className="grid grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-8 w-32 bg-muted rounded" />
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <div className="h-3 w-48 bg-muted rounded mb-3" />
            <div className="grid grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white p-3 rounded border border-border">
                  <div className="h-3 w-12 bg-muted rounded" />
                  <div className="h-5 w-20 bg-muted rounded mt-2" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="px-8 py-6">
          <div className="h-5 w-48 bg-muted rounded mb-4" />
          <div className="border border-border rounded overflow-hidden">
            {/* Table Header */}
            <div className="flex gap-4 p-3 bg-gray-100 border-b border-border">
              {[8, 10, 20, 10, 12, 10, 12, 10].map((w, i) => (
                <div
                  key={i}
                  className="h-4 bg-muted rounded"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
            {/* Table Rows */}
            {[...Array(8)].map((_, rowIndex) => (
              <div
                key={rowIndex}
                className={`flex gap-4 p-3 border-b border-border ${
                  rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                }`}
              >
                {[8, 10, 20, 10, 12, 10, 12, 10].map((w, i) => (
                  <div
                    key={i}
                    className="h-4 bg-muted rounded"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-border flex justify-between">
          <div className="h-4 w-48 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
