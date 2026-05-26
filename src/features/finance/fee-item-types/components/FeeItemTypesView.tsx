"use client";

import { useFeeItemTypes, type FeeItemType } from "../hooks/use-fee-item-types";
import { FeeItemTypesList } from "./FeeItemTypesList";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  /**
   * Initial data from SSR (optional).
   * If provided, used as placeholder while query loads.
   */
  initialData?: {
    feeTypes: FeeItemType[];
    canManage: boolean;
  };
};

/**
 * Client component wrapper that fetches fee item types via TanStack Query.
 *
 * This component can be used in two ways:
 * 1. With SSR hydration: Pass initialData from server component
 * 2. Pure client-side: No initialData, shows loading state
 */
export function FeeItemTypesView({ initialData }: Props) {
  const { data, isLoading, isError, error } = useFeeItemTypes();

  // Use query data if available, otherwise fall back to initialData
  const feeTypes = data?.data ?? initialData?.feeTypes ?? [];
  const canManage = data?.canManage ?? initialData?.canManage ?? false;

  // Show loading state only if no initial data
  if (isLoading && !initialData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">Loading fee types...</p>
      </div>
    );
  }

  // Only show full error UI when there's no data to display
  // If we have cached/SSR data, continue showing it despite refetch errors
  if (isError && feeTypes.length === 0) {
    // Log error for debugging
    console.error("[FeeItemTypesView] Query error:", error);

    const isDev = process.env.NODE_ENV === "development";
    const errorMessage = isDev && error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";

    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="text-destructive" aria-hidden>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-base font-semibold text-foreground">Failed to load fee types</p>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
      </div>
    );
  }

  // Log background refetch errors but continue showing cached data
  if (isError && feeTypes.length > 0) {
    console.error("[FeeItemTypesView] Background refetch failed:", error);
  }

  return <FeeItemTypesList feeTypes={feeTypes} canManage={canManage} />;
}
