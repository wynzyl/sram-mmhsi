import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getAllPaymentCollectionData,
  getPaymentCollectionSummary,
} from "@/features/reports/payment-collection-report.queries";

export async function GET(request: NextRequest) {
  // Auth check
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Permission check
  if (!hasPermission(user.role, "reports:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const schoolYearId = searchParams.get("schoolYearId") || undefined;
  const paymentMethod = searchParams.get("paymentMethod") || undefined;
  const paymentStatus = searchParams.get("paymentStatus") || undefined;

  // Parse dates with defaults (last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const parsedStartDate = startDateParam ? new Date(startDateParam) : null;
  const startDate =
    parsedStartDate && !isNaN(parsedStartDate.getTime())
      ? parsedStartDate
      : thirtyDaysAgo;
  startDate.setHours(0, 0, 0, 0);

  const parsedEndDate = endDateParam ? new Date(endDateParam) : null;
  const endDate =
    parsedEndDate && !isNaN(parsedEndDate.getTime()) ? parsedEndDate : today;
  endDate.setHours(23, 59, 59, 999);

  try {
    // Fetch data in parallel
    const [rows, summary] = await Promise.all([
      getAllPaymentCollectionData({
        startDate,
        endDate,
        schoolYearId,
        paymentMethod,
        paymentStatus,
      }),
      getPaymentCollectionSummary({
        startDate,
        endDate,
        schoolYearId,
        paymentMethod,
        paymentStatus,
      }),
    ]);

    return NextResponse.json({ rows, summary });
  } catch (error) {
    console.error("PDF data fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
