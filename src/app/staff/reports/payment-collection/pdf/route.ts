import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getAllPaymentCollectionData,
  getPaymentCollectionSummary,
} from "@/features/reports/payment-collection-report.queries";
import { PaymentCollectionPDFDocument } from "@/features/reports/components/PaymentCollectionPDFDocument";

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

    // Generate PDF buffer
    const pdfBuffer = await renderToBuffer(
      PaymentCollectionPDFDocument({
        rows,
        summary,
        generatedAt: new Date(),
      })
    );

    // Convert Buffer to Uint8Array for NextResponse
    const pdfBytes = new Uint8Array(pdfBuffer);

    // Generate filename
    const startFormatted = startDateParam || "all";
    const endFormatted = endDateParam || "all";
    const filename = `payment-collection-${startFormatted}-${endFormatted}.pdf`;

    // Return PDF as downloadable file
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
