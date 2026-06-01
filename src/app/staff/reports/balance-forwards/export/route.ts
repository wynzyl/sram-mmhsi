import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getAllBfxData,
  getBfxSummary,
} from "@/features/reports/balance-forward-report.queries";
import {
  BalanceForwardPdfDocument,
  buildBalanceForwardXlsx,
} from "@/features/reports/balance-forward-report.export";
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
 * Unified Balance Forward (BFX) export.
 *
 *   GET /staff/reports/balance-forwards/export?format=pdf|xlsx&startDate&endDate&schoolYearId
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(user.role, "reports:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = parseReportFormat(searchParams.get("format"));
  const range = parseReportDateRange(searchParams);
  const schoolYearId = searchParams.get("schoolYearId") || undefined;

  const filter = {
    startDate: range.startDate,
    endDate: range.endDate,
    schoolYearId,
  };

  try {
    const [rows, summary] = await Promise.all([
      getAllBfxData(filter),
      getBfxSummary(filter),
    ]);

    const filename = reportFilename("balance-forwards", range);

    await logReportExport({
      actor: user,
      report: "balance-forward",
      format,
      rowCount: rows.length,
      filters: { ...filter },
    });

    if (format === "xlsx") {
      const buffer = await buildBalanceForwardXlsx(rows, summary);
      return xlsxResponse(buffer, filename);
    }

    const buffer = await renderToBuffer(
      BalanceForwardPdfDocument({ rows, summary, generatedAt: new Date() }),
    );
    return pdfResponse(buffer, filename);
  } catch (error) {
    console.error("Balance forward export error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
