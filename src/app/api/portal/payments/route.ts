import { NextResponse, connection } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getPortalPaymentsByStudentId } from "@/features/payments/payments.queries";

export async function GET() {
  await connection(); // Requires auth - exclude from prerendering
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow portal sessions with direct studentId
    if (session.accountSource !== "portal" || !session.studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await getPortalPaymentsByStudentId(session.studentId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching portal payments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
