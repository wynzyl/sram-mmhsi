/**
 * TanStack Query hook for fetching cascade discount information.
 *
 * Fetches applied cash discount details and cascade fix data for display
 * in the Point of Payment modal.
 */

import { useQuery } from "@tanstack/react-query";
import type {
  AppliedCashDiscountDetails,
  CascadeFixNeeded,
} from "../payments.types";

interface CascadeInfoResponse {
  appliedCashDiscount: AppliedCashDiscountDetails | null;
  cascadeFixNeeded: CascadeFixNeeded | null;
}

/**
 * Fetch cascade info (applied cash discount + cascade fix data) for an assessment.
 *
 * Used in the Point of Payment modal to display the same cascade discount
 * information shown on the full Payment Processing page.
 *
 * @param assessmentId - The assessment ID to fetch cascade info for
 */
export function useCascadeInfo(assessmentId: string) {
  return useQuery<CascadeInfoResponse>({
    queryKey: ["cascade-info", assessmentId],
    queryFn: async () => {
      const res = await fetch(
        `/api/cashier/cascade-info?assessmentId=${encodeURIComponent(assessmentId)}`
      );
      if (!res.ok) {
        throw new Error("Failed to fetch cascade info");
      }
      return res.json();
    },
    // Cache for 30 seconds - cascade data doesn't change frequently
    staleTime: 30 * 1000,
    // Only fetch when assessmentId is provided
    enabled: Boolean(assessmentId),
  });
}
