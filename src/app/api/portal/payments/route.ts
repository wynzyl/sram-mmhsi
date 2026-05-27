import { NextResponse, connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { PORTAL_ROLES } from "@/lib/constants/roles";
import type { Role } from "@/lib/constants/roles";
import { getPortalPayments } from "@/features/payments/payments.queries";

export async function GET() {
  await connection(); // Requires auth - exclude from prerendering
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!PORTAL_ROLES.includes(user.role as Role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await getPortalPayments(user.id, user.role as Role);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching portal payments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
