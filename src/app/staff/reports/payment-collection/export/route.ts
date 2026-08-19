import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessPaymentReports } from "@/lib/rbac/permissions";
import {
  isReportExportRateLimited,
  getReportExportResetSeconds,
} from "@/lib/security/rateLimit";
import {
  getAllPaymentCollectionData,
  getPaymentCollectionSummary,
} from "@/features/reports/payment-collection-report.queries";
import {
  PaymentCollectionPdfDocument,
  buildPaymentCollectionXlsx,
} from "@/features/reports/payment-collection-report.export";
import {
  pdfResponse,
  xlsxResponse,
  parseReportFormat,
} from "@/features/reports/shared/report-response";
import {
  parseReportDateRange,
  reportFilename,
} from "@/features/reports/shared/report-request";
import { logReportExport } from "@/features/reports/shared/audit-report";

/**
 * Unified Payment Collection export.
 *
 *   GET /staff/reports/payment-collection/export?format=pdf|xlsx&startDate&endDate&...
 *
 * Replaces the legacy /pdf, /pdf-data and /print routes.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPaymentReports(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 10 exports per minute per user
  if (isReportExportRateLimited(user.id)) {
    const resetSeconds = getReportExportResetSeconds(user.id);
    return NextResponse.json(
      { error: `Too many export requests. Try again in ${resetSeconds} seconds.` },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const format = parseReportFormat(searchParams.get("format"));
  const range = parseReportDateRange(searchParams);

  const schoolYearId = searchParams.get("schoolYearId") || undefined;
  const paymentMethod = searchParams.get("paymentMethod") || undefined;
  const paymentStatus = searchParams.get("paymentStatus") || undefined;
  const usageMode = searchParams.get("usageMode") || undefined;

  const filter = {
    startDate: range.startDate,
    endDate: range.endDate,
    schoolYearId,
    paymentMethod,
    paymentStatus,
    usageMode,
  };

  try {
    const [rows, summary] = await Promise.all([
      getAllPaymentCollectionData(filter),
      getPaymentCollectionSummary(filter),
    ]);

    const filename = reportFilename("payment-collection", range);

    await logReportExport({
      actor: user,
      report: "payment-collection",
      format,
      rowCount: rows.length,
      filters: { ...filter },
    });

    if (format === "xlsx") {
      const buffer = await buildPaymentCollectionXlsx(rows, summary);
      return xlsxResponse(buffer, filename);
    }

    const buffer = await renderToBuffer(
      PaymentCollectionPdfDocument({ rows, summary, generatedAt: new Date() }),
    );
    return pdfResponse(buffer, filename);
  } catch (error) {
    console.error("Payment collection export error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
