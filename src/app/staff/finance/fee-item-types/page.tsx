import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/keys";
import { getAllFeeItemTypesAdmin } from "@/features/finance/fee-item-types/fee-item-types.queries";
import { FeeItemTypesView } from "@/features/finance/fee-item-types/components/FeeItemTypesView";
import { CreateFeeItemTypeModal } from "@/features/finance/fee-item-types/components/CreateFeeItemTypeModal";

export const metadata = {
  title: "Fee Item Types | SRAMS",
  description: "Manage reusable fee type definitions",
};

export default async function FeeItemTypesPage() {
  const session = await requireSession();

  const canManage = hasPermission(session.role, "fee_schedules:manage");
  const canView = canManage || hasPermission(session.role, "assessments:read");

  if (!canView) {
    redirect("/staff/dashboard");
  }

  // Fetch data and hydrate query client for SSR
  const feeTypes = await getAllFeeItemTypesAdmin();
  const queryClient = getQueryClient();

  // Prefetch into query cache
  await queryClient.prefetchQuery({
    queryKey: queryKeys.feeItemTypes.list(),
    queryFn: async () => ({
      data: feeTypes,
      canManage,
    }),
  });

  const activeCount = feeTypes.filter((t) => t.isActive).length;
  const discountCount = feeTypes.filter((t) => t.isDiscount).length;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="fin-page">
        {/* Header */}
        <div className="fin-page-header">
          <div className="fin-page-header-main">
            <p className="fin-eyebrow">Finance · Fee Management</p>
            <h1 className="fin-title">Fee Item Types</h1>
            <p className="fin-subtitle">
              Master list of reusable fee type definitions. These are used when building fee
              templates for each assessment band.
            </p>
          </div>
          {canManage && (
            <div className="fin-page-header-actions">
              <CreateFeeItemTypeModal />
            </div>
          )}
        </div>

        {/* KPI strip */}
        <div className="fit-kpi-strip">
          <div className="fit-kpi-item">
            <span className="fit-kpi-value">{feeTypes.length}</span>
            <span className="fit-kpi-label">Total Types</span>
          </div>
          <div className="fit-kpi-divider" aria-hidden />
          <div className="fit-kpi-item">
            <span className="fit-kpi-value fit-kpi-value-ok">{activeCount}</span>
            <span className="fit-kpi-label">Active</span>
          </div>
          <div className="fit-kpi-divider" aria-hidden />
          <div className="fit-kpi-item">
            <span className="fit-kpi-value">{feeTypes.length - activeCount}</span>
            <span className="fit-kpi-label">Inactive</span>
          </div>
          <div className="fit-kpi-divider" aria-hidden />
          <div className="fit-kpi-item">
            <span className="fit-kpi-value fit-kpi-value-disc">{discountCount}</span>
            <span className="fit-kpi-label">Discounts</span>
          </div>
        </div>

        {/* Info callout */}
        <div className="fin-callout fin-callout-muted">
          <div className="fin-callout-icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="fin-callout-title">How fee types work</p>
            <p className="fin-callout-body">
              Fee types are building blocks. Once defined here, add them to a{" "}
              <Link href="/staff/finance/fee-schedules" className="fin-callout-link">
                Fee Template
              </Link>{" "}
              with an amount. Each template can use each fee type only once.
            </p>
          </div>
        </div>

        {/* List - now uses TanStack Query with SSR hydration */}
        <FeeItemTypesView />
      </div>
    </HydrationBoundary>
  );
}
