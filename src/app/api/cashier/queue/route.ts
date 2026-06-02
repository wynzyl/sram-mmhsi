import { fetchCashierQueueData } from "@/features/payments/payments.queries";
import { withAuth, jsonResponse } from "@/lib/api/route-helpers";

export const GET = withAuth(
  { permission: "payments:read" },
  async () => {
    const data = await fetchCashierQueueData();

    return jsonResponse({
      ...data,
      // Serialize dates for JSON
      recentCollections: data.recentCollections.map((c) => ({
        ...c,
        paymentDate: c.paymentDate.toISOString(),
        assessmentId: c.assessmentId,
      })),
    });
  }
);
