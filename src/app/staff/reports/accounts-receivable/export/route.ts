import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/session";
import { getSchoolYears } from "@/lib/queries/schoolYears";
import {
  getAllAccountsReceivableData,
  getAccountsReceivableSummary,
} from "@/features/reports/accounts-receivable-report.queries";
import {
  AccountsReceivablePdfDocument,
  buildAccountsReceivableXlsx,
  type AccountsReceivableReportMeta,
} from "@/features/reports/accounts-receivable-report.export";
import {
  pdfResponse,
  xlsxResponse,
  parseReportFormat,
} from "@/features/reports/shared/report-response";
import { logReportExport } from "@/features/reports/shared/audit-report";

/**
 * Unified Accounts Receivable export.
 *
 *   GET /staff/reports/accounts-receivable/export?format=pdf|xlsx&schoolYearId
 *
 * Defaults to all school years when schoolYearId is omitted.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only super_admin, admin, and finance_officer can access finance reports
  const FINANCE_REPORT_ROLES: readonly string[] = ["super_admin", "admin", "finance_officer"];
  if (!FINANCE_REPORT_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = parseReportFormat(searchParams.get("format"));
  const schoolYearId = searchParams.get("schoolYearId") || undefined;

  const schoolYears = await getSchoolYears();
  const schoolYearLabel = schoolYearId
    ? schoolYears.find((sy) => sy.id === schoolYearId)?.label ?? "—"
    : "All School Years";

  const meta: AccountsReceivableReportMeta = { schoolYearLabel };

  try {
    const [rows, summary] = await Promise.all([
      getAllAccountsReceivableData({ schoolYearId }),
      getAccountsReceivableSummary({ schoolYearId }),
    ]);

    const filename = `accounts-receivable-${
      schoolYearId ? sanitize(schoolYearLabel) : "all-years"
    }`;

    await logReportExport({
      actor: user,
      report: "accounts-receivable",
      format,
      rowCount: rows.length,
      filters: { schoolYearId },
    });

    if (format === "xlsx") {
      const buffer = await buildAccountsReceivableXlsx(rows, summary, meta);
      return xlsxResponse(buffer, filename);
    }

    const buffer = await renderToBuffer(
      AccountsReceivablePdfDocument({
        rows,
        summary,
        meta,
        generatedAt: new Date(),
      }),
    );
    return pdfResponse(buffer, filename);
  } catch (error) {
    console.error("Accounts receivable export error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}

function sanitize(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
