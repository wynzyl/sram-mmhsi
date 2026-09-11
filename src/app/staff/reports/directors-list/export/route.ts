import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  isReportExportRateLimited,
  getReportExportResetSeconds,
} from "@/lib/security/rateLimit";
import { getActiveSchoolYear, getSchoolYears } from "@/lib/queries/schoolYears";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getAllSections } from "@/features/academics/sections/sections.queries";
import { getDirectorsList } from "@/features/academics/directors-list/directors-list.queries";
import {
  DirectorsListPdfDocument,
  buildDirectorsListXlsx,
} from "@/features/academics/directors-list/directors-list-report.export";
import type { DirectorsListReportMeta } from "@/features/academics/directors-list/directors-list.schema";
import {
  pdfResponse,
  xlsxResponse,
  parseReportFormat,
} from "@/features/reports/shared/report-response";
import { logReportExport } from "@/features/reports/shared/audit-report";
import { GRADING_PERIOD_LABELS, type GradingPeriod } from "@/lib/constants/grading-periods";

/**
 * Director's List export.
 *
 *   GET /staff/reports/directors-list/export?format=pdf|xlsx&schoolYearId&gradingPeriod&gradeLevelId&sectionId
 *
 * Defaults to the active school year and Q1 when parameters are omitted.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(user.role, "grades:read")) {
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
  const gradeLevelId = searchParams.get("gradeLevelId") || undefined;
  const sectionId = searchParams.get("sectionId") || undefined;
  const gradingPeriod = searchParams.get("gradingPeriod") || "Q1";

  // Resolve school year (default = active).
  const [schoolYears, gradeLevels, sections, activeYear] = await Promise.all([
    getSchoolYears(),
    getGradeLevels(),
    getAllSections(),
    getActiveSchoolYear(),
  ]);
  const schoolYearId = searchParams.get("schoolYearId") || activeYear?.id;

  if (!schoolYearId) {
    return NextResponse.json(
      { error: "No active school year set." },
      { status: 400 }
    );
  }

  const schoolYearLabel =
    schoolYears.find((sy) => sy.id === schoolYearId)?.label ?? "—";
  const gradeLabel = gradeLevelId
    ? gradeLevels.find((g) => g.id === gradeLevelId)?.name ?? "Grade"
    : "All Grades";
  const sectionLabel = sectionId
    ? sections.find((s) => s.id === sectionId)?.name ?? "Section"
    : "All Sections";
  const gradingPeriodLabel =
    GRADING_PERIOD_LABELS[gradingPeriod as GradingPeriod] || gradingPeriod;

  const meta: DirectorsListReportMeta = {
    schoolYearLabel,
    gradingPeriod,
    gradingPeriodLabel,
    gradeLabel,
    sectionLabel,
    generatedAt: new Date(),
  };

  try {
    const result = await getDirectorsList({
      schoolYearId,
      gradingPeriod,
      gradeLevelId,
      sectionId,
    });

    const filename = `directors-list-${sanitize(schoolYearLabel)}-${sanitize(gradingPeriod)}${
      gradeLevelId ? `-${sanitize(gradeLabel)}` : ""
    }`;

    await logReportExport({
      actor: user,
      report: "directors-list",
      format,
      rowCount: result.entries.length,
      filters: { schoolYearId, gradingPeriod, gradeLevelId, sectionId },
    });

    if (format === "xlsx") {
      const buffer = await buildDirectorsListXlsx(result.entries, meta);
      return xlsxResponse(buffer, filename);
    }

    const buffer = await renderToBuffer(
      DirectorsListPdfDocument({
        rows: result.entries,
        meta,
        generatedAt: new Date(),
      })
    );
    return pdfResponse(buffer, filename);
  } catch (error) {
    console.error("Director's List export error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}
