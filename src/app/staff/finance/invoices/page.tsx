import { Suspense } from "react";
import { Metadata } from "next";
import { InternalInvoicesListPage } from "@/app/page-templates/invoices/invoices-index-page";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Invoices | SRAMS",
};

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    gradeLevel?: string;
    page?: string;
    pageSize?: string;
  }>;
};

/**
 * Instant navigation - full invoices list skeleton shown while data loads.
 */
export default function StaffInvoicesPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<InvoicesListSkeleton />}>
      <InternalInvoicesListPage
        searchParams={searchParams}
        invoicesListPath="/staff/finance/invoices"
        deniedRedirect="/staff/finance"
      />
    </Suspense>
  );
}

function InvoicesListSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-16" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Filters + Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
