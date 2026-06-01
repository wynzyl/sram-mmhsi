import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getActiveSchoolYear, getSchoolYears } from "@/lib/queries/schoolYears";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getAllStudentListData } from "@/features/reports/student-list-report.queries";
import {
  StudentListPdfDocument,
  buildStudentListXlsx,
  type StudentListReportMeta,
} from "@/features/reports/student-list-report.export";
import {
  pdfResponse,
  xlsxResponse,
  parseReportFormat,
} from "@/features/reports/shared/report-response";
import { logReportExport } from "@/features/reports/shared/audit-report";

/**
 * Unified Student List export.
 *
 *   GET /staff/reports/student-list/export?format=pdf|xlsx&schoolYearId&gradeLevelId
 *
 * Defaults to the active school year when schoolYearId is omitted.
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
  const gradeLevelId = searchParams.get("gradeLevelId") || undefined;

  // Resolve school year (default = active).
  const [schoolYears, gradeLevels, activeYear] = await Promise.all([
    getSchoolYears(),
    getGradeLevels(),
    getActiveSchoolYear(),
  ]);
  const schoolYearId = searchParams.get("schoolYearId") || activeYear?.id;

  if (!schoolYearId) {
    return NextResponse.json(
      { error: "No active school year set." },
      { status: 400 },
    );
  }

  const schoolYearLabel =
    schoolYears.find((sy) => sy.id === schoolYearId)?.label ?? "—";
  const gradeLabel = gradeLevelId
    ? gradeLevels.find((g) => g.id === gradeLevelId)?.name ?? "Grade"
    : "All Grades";

  const meta: StudentListReportMeta = { schoolYearLabel, gradeLabel };

  try {
    const rows = await getAllStudentListData({ schoolYearId, gradeLevelId });

    const filename = `student-list-${sanitize(schoolYearLabel)}${
      gradeLevelId ? `-${sanitize(gradeLabel)}` : ""
    }`;

    await logReportExport({
      actor: user,
      report: "student-list",
      format,
      rowCount: rows.length,
      filters: { schoolYearId, gradeLevelId },
    });

    if (format === "xlsx") {
      const buffer = await buildStudentListXlsx(rows, meta);
      return xlsxResponse(buffer, filename);
    }

    const buffer = await renderToBuffer(
      StudentListPdfDocument({ rows, meta, generatedAt: new Date() }),
    );
    return pdfResponse(buffer, filename);
  } catch (error) {
    console.error("Student list export error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}
