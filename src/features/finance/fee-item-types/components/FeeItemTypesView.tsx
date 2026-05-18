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
      <div className="fin-loading">
        <Spinner size="lg" />
        <p className="fin-loading-text">Loading fee types...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="fin-error">
        <div className="fin-error-icon" aria-hidden>
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
        <p className="fin-error-title">Failed to load fee types</p>
        <p className="fin-error-message">
          {error instanceof Error ? error.message : "An unexpected error occurred"}
        </p>
      </div>
    );
  }

  return <FeeItemTypesList feeTypes={feeTypes} canManage={canManage} />;
}
