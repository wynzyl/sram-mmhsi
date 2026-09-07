import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import BookletForm from "@/features/finance/components/BookletForm";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Register Receipt Booklet",
};

/**
 * Instant navigation - full booklet form skeleton shown while data loads.
 */
export default function StaffNewBookletPage() {
  return (
    <Suspense fallback={<NewBookletSkeleton />}>
      <NewBookletContent />
    </Suspense>
  );
}

function NewBookletSkeleton() {
  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4 mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
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
        <div className="pt-2 flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}

async function NewBookletContent() {
  const session = await requireSession();
  if (!hasPermission(session.role, "booklets:manage")) {
    redirect("/staff/finance");
  }

  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">Register OR Booklet</h1>
          <p className="page-subtitle">
            Series line must match the printed range (e.g. AK 00051-00100), prefix, and exactly 50 OR numbers.
          </p>
        </div>
      </div>

      <BookletForm redirectTo="/staff/finance/booklets" />
    </div>
  );
}
