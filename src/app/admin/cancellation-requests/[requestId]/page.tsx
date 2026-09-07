import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { getCancellationRequestById } from "@/features/enrollments/enrollment-cancellation.queries";
import CancellationRequestDetailView from "@/features/enrollments/components/CancellationRequestDetail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = { title: "Review Cancellation Request" };

interface PageProps {
  params: Promise<{ requestId: string }>;
}

/**
 * Instant navigation - full cancellation request detail skeleton shown while data loads.
 */
export default function CancellationRequestDetailPageWrapper({
  params,
}: PageProps) {
  return (
    <Suspense fallback={<CancellationRequestSkeleton />}>
      <CancellationRequestContent params={params} />
    </Suspense>
  );
}

function CancellationRequestSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Skeleton className="h-9 w-28" />
      </header>

      {/* Request header card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
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
        <Skeleton className="h-5 w-36 mb-3" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <Skeleton className="h-3 w-24 mb-1" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>

      {/* Refund calculation */}
      <div className="rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-3 pt-3 flex justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

async function CancellationRequestContent({ params }: PageProps) {
  const session = await requireStaffSession();

  // Only admin/super_admin can access
  if (!["admin", "super_admin"].includes(session.role)) {
    redirect("/staff/approvals?section=cancellation");
  }

  const { requestId } = await params;

  const request = await getCancellationRequestById(requestId);

  if (!request) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Link href="/staff/approvals?section=cancellation">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </Button>
        </Link>
      </header>

      <CancellationRequestDetailView
        request={request}
        currentUserId={session.userId}
      />
    </div>
  );
}
