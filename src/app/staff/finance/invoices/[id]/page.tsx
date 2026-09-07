import { Suspense } from "react";
import { Metadata } from "next";
import { InternalInvoiceDetailPage } from "@/app/page-templates/invoices/invoice-detail-page";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Invoice Details | SRAMS",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Instant navigation - full invoice detail skeleton shown while data loads.
 */
export default function StaffInvoiceDetailPageWrapper({ params }: PageProps) {
  return (
    <Suspense fallback={<InvoiceDetailSkeleton />}>
      <InvoiceDetailContent params={params} />
    </Suspense>
  );
}

function InvoiceDetailSkeleton() {
  return (
    <div className="page-container space-y-6">
      {/* Back button + Actions */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Invoice header card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-28 mt-1" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20 mb-1" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* Student info */}
      <div className="rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <Skeleton className="h-3 w-24 mb-1" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="bg-muted px-4 py-3 border-b border-border">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="bg-muted px-4 py-3 border-t border-border flex justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-28" />
        </div>
      </div>
    </div>
  );
}

async function InvoiceDetailContent({ params }: PageProps) {
  const { id } = await params;
  return (
    <InternalInvoiceDetailPage
      invoiceId={id}
      invoicesListPath="/staff/finance/invoices"
      deniedRedirect="/staff/finance"
      assessmentsBasePath="/staff/assessments"
    />
  );
}
