import { NextResponse, connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { fetchCashierQueueData } from "@/features/payments/payments.queries";

export async function GET() {
  await connection(); // Requires auth - exclude from prerendering
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "payments:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await fetchCashierQueueData();

    return NextResponse.json({
      ...data,
      // Serialize dates for JSON
      recentCollections: data.recentCollections.map((c) => ({
        ...c,
        paymentDate: c.paymentDate.toISOString(),
        assessmentId: c.assessmentId,
      })),
    });
  } catch (error) {
    console.error("Error fetching cashier queue:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
