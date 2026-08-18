/**
 * API endpoint for fetching cascade discount information.
 *
 * Returns data about applied cash discounts and cascade fixes needed
 * for display in the Point of Payment modal.
 */

import { withAuth, jsonResponse, responses } from "@/lib/api/route-helpers";
import {
  getAppliedCashDiscountDetails,
  checkCascadeFixNeeded,
} from "@/features/payments/payments.queries";

export const GET = withAuth(
  { permission: "payments:read" },
  async (request) => {
    const url = new URL(request.url);
    const assessmentId = url.searchParams.get("assessmentId");

    if (!assessmentId) {
      return responses.badRequest("assessmentId is required");
    }

    const [appliedCashDiscount, cascadeFixNeeded] = await Promise.all([
      getAppliedCashDiscountDetails(assessmentId),
      checkCascadeFixNeeded(assessmentId),
    ]);

    return jsonResponse({
      appliedCashDiscount,
      cascadeFixNeeded,
    });
  }
);
