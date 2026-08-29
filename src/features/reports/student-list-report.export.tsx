import "server-only";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import {
  TabularReportDocument,
  type ReportColumn,
} from "./shared/pdf-primitives";
import { buildReportWorkbook, type XlsxColumn } from "./shared/xlsx-report";
import type { StudentListRow } from "./student-list-report.queries";

/**
 * Student List (masterlist) report — both export tracks.
 *
 * Enrolled students for a school year with their primary guardian's contact
 * details. Landscape so the seven wide columns (two addresses + email) fit.
 * Track 1 (PDF) and Track 2 (XLSX) share the row→cell logic here.
 */

const REPORT_TITLE = "Student List";
const SHEET_NAME = "Student List";

export interface StudentListReportMeta {
  schoolYearLabel: string;
  gradeLabel: string; // "All Grades" or a specific grade name
}

function buildSubtitle(meta: StudentListReportMeta): string {
  return `School Year ${meta.schoolYearLabel} · ${meta.gradeLabel} · Enrolled`;
}

// ─── PDF (Track 1) ─────────────────────────────────────────────────────────────

function formatStudentName(r: StudentListRow): string {
  return r.isSpecialEducation ? `${r.studentName} (SPED)` : r.studentName;
}

const pdfColumns: ReportColumn<StudentListRow>[] = [
  { header: "Student Name", width: "18%", cell: formatStudentName },
  { header: "Student ID", width: "10%", mono: true, cell: (r) => r.studentRef },
  { header: "Grade", width: "9%", cell: (r) => r.gradeLevel },
  { header: "Address", width: "18%", cell: (r) => r.address },
  { header: "Guardian Name", width: "16%", cell: (r) => r.guardianName },
  { header: "Contact No.", width: "13%", cell: (r) => r.guardianContact },
  { header: "Email", width: "16%", cell: (r) => r.guardianEmail },
];

export function StudentListPdfDocument({
  rows,
  meta,
  generatedAt,
}: {
  rows: StudentListRow[];
  meta: StudentListReportMeta;
  generatedAt: Date;
}): ReactElement<DocumentProps> {
  return (
    <TabularReportDocument
      title={REPORT_TITLE}
      subtitle={buildSubtitle(meta)}
      generatedAt={generatedAt}
      summaryItems={[{ label: "Total Students", value: String(rows.length) }]}
      columns={pdfColumns}
      rows={rows}
      getRowKey={(r) => r.studentId}
      orientation="landscape"
      firstPageRows={14}
      rowsPerPage={18}
      emptyMessage="No enrolled students found for the selected filters."
    />
  );
}

// ─── XLSX (Track 2) ────────────────────────────────────────────────────────────

const xlsxColumns: XlsxColumn<StudentListRow>[] = [
  { header: "Student Name", width: 28, value: formatStudentName },
  { header: "Student ID", width: 14, value: (r) => r.studentRef },
  { header: "Grade", width: 12, value: (r) => r.gradeLevel },
  { header: "Address", width: 32, value: (r) => r.address },
  { header: "Guardian Name", width: 24, value: (r) => r.guardianName },
  { header: "Contact No.", width: 16, value: (r) => r.guardianContact },
  { header: "Email", width: 26, value: (r) => r.guardianEmail },
];

export function buildStudentListXlsx(
  rows: StudentListRow[],
  meta: StudentListReportMeta,
): Promise<Buffer> {
  return buildReportWorkbook({
    sheetName: SHEET_NAME,
    title: REPORT_TITLE,
    periodLabel: buildSubtitle(meta),
    columns: xlsxColumns,
    rows,
    summaryItems: [{ label: "Total Students", value: rows.length }],
  });
}
