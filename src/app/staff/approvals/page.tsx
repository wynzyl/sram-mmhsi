import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import VoidRequestsView from "@/features/approvals/VoidRequestsView";
import DiscountRequestsView from "@/features/approvals/DiscountRequestsView";
import CancellationRequestsView from "@/features/approvals/CancellationRequestsView";
import ClearancesView from "@/features/approvals/ClearancesView";

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
 * Approvals hub — a single staff entry point that consolidates the previously
 * separate review queues (void requests, discount requests, enrollment
 * cancellations, clearances) into permission-gated section tabs. Each section
 * renders its existing queue view verbatim; only the sidebar/nav surface changed.
 */
export default async function ApprovalsPage({
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

  const requested = params.section as Section | undefined;
  const active =
    requested && visibleSections.some((s) => s.key === requested)
      ? requested
      : visibleSections[0].key;

  return (
    <PageContainer>
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
