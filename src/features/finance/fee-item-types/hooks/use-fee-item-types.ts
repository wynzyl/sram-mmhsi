"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  createFeeItemTypeAction,
  updateFeeItemTypeAction,
  toggleFeeItemTypeAction,
} from "../fee-item-types.actions";
import type {
  CreateFeeItemTypeFormState,
  UpdateFeeItemTypeFormState,
  ToggleFeeItemTypeFormState,
} from "../fee-item-types.schema";
import type { FeeItemTypeListRow } from "../fee-item-types.queries";

// ─────────────────────────────────────────────────────────────────
// Types — Re-export query DTO for consumers
// ─────────────────────────────────────────────────────────────────

export type FeeItemType = FeeItemTypeListRow;

export type FeeItemTypesResponse = {
  data: FeeItemType[];
  canManage: boolean;
};

// ─────────────────────────────────────────────────────────────────
// Query Hook
// ─────────────────────────────────────────────────────────────────

async function fetchFeeItemTypes(): Promise<FeeItemTypesResponse> {
  const res = await fetch("/api/fee-item-types");

  if (!res.ok) {
    throw new Error(`Failed to fetch fee item types: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetches all fee item types with permission context.
 *
 * Returns:
 * - `data`: Array of FeeItemType objects
 * - `canManage`: Boolean indicating if user can manage fee types
 */
export function useFeeItemTypes() {
  return useQuery({
    queryKey: queryKeys.feeItemTypes.list(),
    queryFn: fetchFeeItemTypes,
    // Stale time: 2 minutes (fee types rarely change)
    staleTime: 2 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────
// Mutation Hooks
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new fee item type.
 * Invalidates the fee item types cache on success.
 */
export function useCreateFeeItemType() {
  const queryClient = useQueryClient();

  return useMutation<CreateFeeItemTypeFormState, Error, FormData>({
    mutationFn: async (formData) => {
      return createFeeItemTypeAction({}, formData);
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.feeItemTypes.all,
        });
      }
    },
  });
}

/**
 * Update an existing fee item type.
 * Invalidates the fee item types cache on success.
 */
export function useUpdateFeeItemType() {
  const queryClient = useQueryClient();

  return useMutation<UpdateFeeItemTypeFormState, Error, FormData>({
    mutationFn: async (formData) => {
      return updateFeeItemTypeAction({}, formData);
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.feeItemTypes.all,
        });
      }
    },
  });
}

/**
 * Toggle a fee item type's active status.
 * Invalidates the fee item types cache on success.
 */
export function useToggleFeeItemType() {
  const queryClient = useQueryClient();

  return useMutation<ToggleFeeItemTypeFormState, Error, FormData>({
    mutationFn: async (formData) => {
      return toggleFeeItemTypeAction({}, formData);
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.feeItemTypes.all,
        });
      }
    },
  });
}
