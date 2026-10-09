import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessFinanceReports } from "@/lib/rbac/permissions";
import {
  isReportExportRateLimited,
  getReportExportResetSeconds,
} from "@/lib/security/rateLimit";
import { getSchoolYears } from "@/lib/queries/schoolYears";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import {
  getAllAccountsReceivableData,
  getAccountsReceivableSummary,
  groupByGradeLevel,
} from "@/features/reports/accounts-receivable-report.queries";
import {
  AccountsReceivableGroupedPdfDocument,
  buildAccountsReceivableGroupedXlsx,
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
 *   GET /staff/reports/accounts-receivable/export?format=pdf|xlsx&schoolYearId&gradeLevelId
 *
 * Defaults to all school years when schoolYearId is omitted.
 * Groups data by grade level with subtotals.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessFinanceReports(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 10 exports per minute per user
  if (isReportExportRateLimited(user.id)) {
    const resetSeconds = getReportExportResetSeconds(user.id);
    return NextResponse.json(
      { error: `Too many export requests. Try again in ${resetSeconds} seconds.` },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const format = parseReportFormat(searchParams.get("format"));
  const schoolYearId = searchParams.get("schoolYearId") || undefined;
  const gradeLevelId = searchParams.get("gradeLevelId") || undefined;

  const [schoolYears, gradeLevels] = await Promise.all([
    getSchoolYears(),
    getGradeLevels(),
  ]);

  const schoolYearLabel = schoolYearId
    ? schoolYears.find((sy) => sy.id === schoolYearId)?.label ?? "—"
    : "All School Years";

  const gradeLevelLabel = gradeLevelId
    ? gradeLevels.find((gl) => gl.id === gradeLevelId)?.name
    : undefined;

  const meta: AccountsReceivableReportMeta = {
    schoolYearLabel,
    gradeLevelLabel,
  };

  try {
    const [rows, summary] = await Promise.all([
      getAllAccountsReceivableData({ schoolYearId, gradeLevelId }),
      getAccountsReceivableSummary({ schoolYearId, gradeLevelId }),
    ]);

    // Group data by grade level
    const groups = groupByGradeLevel(rows);

    // Build filename
    const filenameParts = ["accounts-receivable"];
    if (schoolYearId) {
      filenameParts.push(sanitize(schoolYearLabel));
    } else {
      filenameParts.push("all-years");
    }
    if (gradeLevelLabel) {
      filenameParts.push(sanitize(gradeLevelLabel));
    }
    const filename = filenameParts.join("-");

    await logReportExport({
      actor: user,
      report: "accounts-receivable",
      format,
      rowCount: rows.length,
      filters: { schoolYearId, gradeLevelId },
    });

    if (format === "xlsx") {
      const buffer = await buildAccountsReceivableGroupedXlsx(groups, summary, meta);
      return xlsxResponse(buffer, filename);
    }

    const buffer = await renderToBuffer(
      AccountsReceivableGroupedPdfDocument({
        groups,
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
