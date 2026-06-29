import { NextResponse, connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getAllFeeItemTypesAdmin } from "@/features/finance/fee-item-types/fee-item-types.queries";

export async function GET() {
  await connection(); // Requires auth - exclude from prerendering
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Permission check: finance officers can manage, others can read
    const canManage = hasPermission(user.role, "fee_schedules:manage");
    const canView = canManage || hasPermission(user.role, "assessments:read");

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Reuse the shared query helper so columns stay aligned with FeeItemTypeListRow
    const data = await getAllFeeItemTypesAdmin();

    return NextResponse.json({
      data,
      canManage,
    });
  } catch (error) {
    console.error("Error fetching fee item types:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
