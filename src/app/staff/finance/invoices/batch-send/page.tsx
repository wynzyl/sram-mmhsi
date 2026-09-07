import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import BatchSendInvoiceForm from "@/features/finance/components/invoices/BatchSendInvoiceForm";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Batch Send Invoices | SRAMS",
  description: "Send invoices via email to multiple guardians",
};

/**
 * Instant navigation - full batch send skeleton shown while data loads.
 */
export default function BatchSendInvoicePage() {
  return (
    <Suspense fallback={<BatchSendSkeleton />}>
      <BatchSendContent />
    </Suspense>
  );
}

function BatchSendSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted border-b border-border px-4 py-3">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-2" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2">
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>

      <Skeleton className="h-3 w-80 mx-auto" />
    </div>
  );
}

async function BatchSendContent() {
  const session = await requireSession();

  if (!hasPermission(session.role, "invoices:send")) {
    redirect("/staff/finance/invoices");
  }

  const [activeSchoolYear, gradeLevels] = await Promise.all([
    getActiveSchoolYear(),
    getGradeLevels(),
  ]);

  if (!activeSchoolYear) {
    return (
      <div className="page-container--full space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
            Batch Send Invoices
          </h1>
          <p className="text-sm text-muted-foreground">
            Send invoices via email to guardians
          </p>
        </div>
        <div className="rounded-lg border border-warning/25 bg-warning-tint p-6">
          <h2 className="text-lg font-semibold text-warning">No Active School Year</h2>
          <p className="mt-2 text-sm text-warning">
            No active school year found. Please set an active school year before sending invoices.
          </p>
        </div>
      </div>
    );
  }

  // Map grade levels to the format expected by the form
  const gradeLevelOptions = gradeLevels.map((gl) => ({
    id: gl.id,
    name: gl.name,
  }));

  return (
    <div className="page-container--full space-y-6">
      {/* Clean Page Header - Title + Subtitle Only */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Batch Send Invoices
        </h1>
        <p className="text-sm text-muted-foreground">
          {activeSchoolYear.label} • Send invoices to guardians via email
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <BatchSendInvoiceForm
          gradeLevels={gradeLevelOptions}
          schoolYearId={activeSchoolYear.id}
          schoolYearLabel={activeSchoolYear.label}
        />
      </section>

      {/* Footer Note */}
      <p className="text-center text-[0.7rem] text-muted-foreground pb-2">
        Need to manage invoices?{" "}
        <Link
          href="/staff/finance/invoices"
          className="font-medium text-primary hover:underline"
        >
          Return to invoice list
        </Link>
        . Confidential institutional data.
      </p>
    </div>
  );
}
