import { checkFullPaymentCashDiscountEligibility } from "@/features/payments/payments.queries";
import { withAuth, jsonResponse, responses } from "@/lib/api/route-helpers";
import { NextRequest } from "next/server";

/**
 * Check full payment cash discount eligibility.
 *
 * GET /api/cashier/cash-discount?assessmentId=xxx&amount=yyy
 *
 * Returns eligibility status and discount details if eligible.
 */
export const GET = withAuth(
  { permission: "payments:post" },
  async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;
    const assessmentId = searchParams.get("assessmentId");
    const amountStr = searchParams.get("amount");

    if (!assessmentId) {
      return responses.badRequest("assessmentId is required");
    }

    if (!amountStr) {
      return responses.badRequest("amount is required");
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return responses.badRequest("amount must be a positive number");
    }

    const eligibility = await checkFullPaymentCashDiscountEligibility(
      assessmentId,
      amount
    );

    return jsonResponse({
      ...eligibility,
      // Serialize cutoff date if present
      discountDetails: eligibility.discountDetails
        ? {
            ...eligibility.discountDetails,
            cutoffDate: eligibility.discountDetails.cutoffDate.toISOString(),
          }
        : undefined,
    });
  }
);
