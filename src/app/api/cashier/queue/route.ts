import { fetchCashierQueueData } from "@/features/payments/payments.queries";
import { withAuth, jsonResponse } from "@/lib/api/route-helpers";

export const GET = withAuth(
  { permission: "payments:read" },
  async (request) => {
    // Parse pagination params from URL
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50));

    const data = await fetchCashierQueueData({ page, pageSize });

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
