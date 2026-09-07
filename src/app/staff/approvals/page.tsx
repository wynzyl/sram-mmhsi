import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";
import VoidRequestsView from "@/features/approvals/VoidRequestsView";
import DiscountRequestsView from "@/features/approvals/DiscountRequestsView";
import CancellationRequestsView from "@/features/approvals/CancellationRequestsView";
import ClearancesView from "@/features/approvals/ClearancesView";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Approvals",
  description: "Review void, discount, cancellation, and clearance requests in one place.",
};

type Section = "void" | "discount" | "cancellation" | "clearance";

type ApprovalsSearchParams = {
  section?: string;
  tab?: string;
  page?: string;
  schoolYearId?: string;
  gradeLevelId?: string;
  search?: string;
};

/**
 * Instant navigation - full approvals hub skeleton shown while data loads.
 */
export default function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<ApprovalsSearchParams>;
}) {
  return (
    <Suspense fallback={<ApprovalsSkeleton />}>
      <ApprovalsContent searchParams={searchParams} />
    </Suspense>
  );
}

function ApprovalsSkeleton() {
  return (
    <PageContainer width="full">
      <div className="space-y-1 mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Section tabs skeleton */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-28" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="mt-6 space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-20 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

async function ApprovalsContent({
  searchParams,
}: {
  searchParams: Promise<ApprovalsSearchParams>;
}) {
  const session = await requireSession();
  const role = session.role;
  const params = await searchParams;

  const sections: { key: Section; label: string; show: boolean }[] = [
    {
      key: "void",
      label: "Void Requests",
      show:
        hasPermission(role, "payments:void_request") ||
        hasPermission(role, "payments:void_approve"),
    },
    {
      key: "discount",
      label: "Discount Requests",
      show: hasPermission(role, "discounts:review"),
    },
    {
      key: "cancellation",
      label: "Cancellations",
      show: role === "admin" || role === "super_admin",
    },
    {
      key: "clearance",
      label: "Clearances",
      show: hasPermission(role, "clearances:read"),
    },
  ];

  const visibleSections = sections.filter((s) => s.show);

  if (visibleSections.length === 0) {
    redirect("/staff");
  }

  const active: Section =
    visibleSections.find((s) => s.key === params.section)?.key ??
    visibleSections[0].key;

  return (
    <PageContainer width="full">
      <PageHeader
        title="Approvals"
        description="Review and process the requests that need a decision before transactions can proceed."
      />

      {/* Section tabs */}
      <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Approval sections">
        {visibleSections.map((s) => (
          <Link
            key={s.key}
            href={`/staff/approvals?section=${s.key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === s.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {active === "void" && <VoidRequestsView searchParams={searchParams} />}
        {active === "discount" && <DiscountRequestsView searchParams={searchParams} />}
        {active === "cancellation" && <CancellationRequestsView />}
        {active === "clearance" && <ClearancesView />}
      </div>
    </PageContainer>
  );
}
