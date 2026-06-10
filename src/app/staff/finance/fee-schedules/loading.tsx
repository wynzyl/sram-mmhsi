import { Skeleton } from "@/components/ui/skeleton";

export default function FeeSchedulesLoading() {
  return (
    <div className="px-8 py-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start gap-6 mb-6">
        <div className="flex-1 min-w-[280px]">
          <Skeleton className="h-3 w-40 mb-2" />
          <Skeleton className="h-7 w-48 mb-3" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36 shrink-0" />
      </div>

      {/* Info callout */}
      <Skeleton className="h-24 w-full rounded-md mb-6" />

      {/* School year cards */}
      <div className="flex flex-col gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="bg-card border border-border rounded-md">
            <div className="flex justify-between items-center gap-4 px-5 py-4 border-b border-border">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="p-5">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-36 w-full rounded-md" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
