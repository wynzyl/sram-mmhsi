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
      <div className="px-8 py-6 max-w-[1200px] mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Finance · Fee Management</p>
            <h1 className="text-2xl font-bold text-foreground mb-1.5">Fee Item Types</h1>
            <p className="text-sm text-muted-foreground">
              Master list of reusable fee type definitions. These are used when building fee
              templates for each assessment band.
            </p>
          </div>
          {canManage && (
            <div>
              <CreateFeeItemTypeModal />
            </div>
          )}
        </div>

        {/* KPI strip */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-bold text-foreground">{feeTypes.length}</span>
            <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Total Types</span>
          </div>
          <div className="w-px h-8 bg-border" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-bold text-green-500">{activeCount}</span>
            <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Active</span>
          </div>
          <div className="w-px h-8 bg-border" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-bold text-foreground">{feeTypes.length - activeCount}</span>
            <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Inactive</span>
          </div>
          <div className="w-px h-8 bg-border" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-bold text-primary">{discountCount}</span>
            <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Discounts</span>
          </div>
        </div>

        {/* Info callout */}
        <div className="flex gap-3 p-4 bg-muted border border-border rounded-md">
          <div className="shrink-0 text-muted-foreground" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">How fee types work</p>
            <p className="text-sm text-muted-foreground m-0">
              Fee types are building blocks. Once defined here, add them to a{" "}
              <Link href="/staff/finance/fee-schedules" className="text-primary no-underline font-medium hover:underline">
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
