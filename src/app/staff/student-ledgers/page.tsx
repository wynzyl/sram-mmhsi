import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentLedgersPage } from "@/app/page-templates/student-ledgers/student-ledgers-page";

// Instant navigation enabled - uses Suspense for streaming

/**
 * Instant navigation - full student ledgers skeleton shown while data loads.
 */
export default function Page(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<StudentLedgersSkeleton />}>
      <StudentLedgersPage searchParams={props.searchParams} />
    </Suspense>
  );
}

function StudentLedgersSkeleton() {
  return (
    <div className="page-container space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center gap-2 border-b border-border px-4 py-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
