import "server-only";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import {
  TabularReportDocument,
  type ReportColumn,
} from "@/features/reports/shared/pdf-primitives";
import { buildReportWorkbook, type XlsxColumn } from "@/features/reports/shared/xlsx-report";
import type { DirectorsListEntry, DirectorsListReportMeta } from "./directors-list.schema";

/**
 * Director's List Report — both export tracks.
 *
 * Lists students who qualify for Director's List with their GWA and rank.
 * Track 1 (PDF) and Track 2 (XLSX) share the row→cell logic here.
 */

const REPORT_TITLE = "Director's List";
const SHEET_NAME = "Directors List";

/**
 * Calculate group counts for summary statistics.
 */
function getGroupCounts(rows: DirectorsListEntry[]) {
  return {
    elemCount: rows.filter((r) =>
      ["casa", "lower_elem", "higher_elem"].includes(r.gradeGroup)
    ).length,
    jhsCount: rows.filter((r) => r.gradeGroup === "jhs").length,
    shsCount: rows.filter((r) => r.gradeGroup === "shs").length,
  };
}

function buildSubtitle(meta: DirectorsListReportMeta): string {
  const parts = [
    `School Year ${meta.schoolYearLabel}`,
    meta.gradingPeriodLabel,
    meta.gradeLabel,
  ];
  if (meta.sectionLabel && meta.sectionLabel !== "All Sections") {
    parts.push(meta.sectionLabel);
  }
  return parts.join(" · ");
}

// ─── PDF (Track 1) ─────────────────────────────────────────────────────────────

const pdfColumns: ReportColumn<DirectorsListEntry>[] = [
  {
    header: "Rank",
    width: "8%",
    align: "center",
    cell: (r) => `#${r.rank}`,
  },
  {
    header: "Student ID",
    width: "12%",
    mono: true,
    cell: (r) => r.studentRef,
  },
  {
    header: "Student Name",
    width: "25%",
    cell: (r) => r.studentName,
  },
  {
    header: "Grade Level",
    width: "15%",
    cell: (r) => r.gradeLevelName,
  },
  {
    header: "Section",
    width: "12%",
    cell: (r) => r.sectionName,
  },
  {
    header: "GWA",
    width: "10%",
    align: "right",
    cell: (r) => r.gwa.toFixed(2),
  },
  {
    header: "Subjects",
    width: "8%",
    align: "center",
    cell: (r) => String(r.subjectCount),
  },
  {
    header: "Threshold",
    width: "10%",
    align: "center",
    cell: (r) => `${r.threshold}+`,
  },
];

export function DirectorsListPdfDocument({
  rows,
  meta,
  generatedAt,
}: {
  rows: DirectorsListEntry[];
  meta: DirectorsListReportMeta;
  generatedAt: Date;
}): ReactElement<DocumentProps> {
  const { elemCount, jhsCount, shsCount } = getGroupCounts(rows);

  return (
    <TabularReportDocument
      title={REPORT_TITLE}
      subtitle={buildSubtitle(meta)}
      generatedAt={generatedAt}
      summaryItems={[
        { label: "Total Qualifiers", value: String(rows.length), emphasis: true },
        { label: "Elementary", value: String(elemCount) },
        { label: "Junior High", value: String(jhsCount) },
        { label: "Senior High", value: String(shsCount) },
      ]}
      columns={pdfColumns}
      rows={rows}
      getRowKey={(r) => r.studentId}
      orientation="portrait"
      firstPageRows={16}
      rowsPerPage={22}
      emptyMessage="No students qualify for Director's List with the selected filters."
    />
  );
}

// ─── XLSX (Track 2) ────────────────────────────────────────────────────────────

const xlsxColumns: XlsxColumn<DirectorsListEntry>[] = [
  { header: "Rank", width: 8, align: "center", value: (r) => r.rank },
  { header: "Student ID", width: 14, value: (r) => r.studentRef },
  { header: "Student Name", width: 28, value: (r) => r.studentName },
  { header: "Grade Level", width: 16, value: (r) => r.gradeLevelName },
  { header: "Section", width: 14, value: (r) => r.sectionName },
  { header: "GWA", width: 10, align: "right", numFmt: "0.00", value: (r) => r.gwa },
  { header: "Subjects", width: 10, align: "center", value: (r) => r.subjectCount },
  { header: "Threshold", width: 10, align: "center", value: (r) => r.threshold },
];

export function buildDirectorsListXlsx(
  rows: DirectorsListEntry[],
  meta: DirectorsListReportMeta
): Promise<Buffer> {
  const { elemCount, jhsCount, shsCount } = getGroupCounts(rows);

  return buildReportWorkbook({
    sheetName: SHEET_NAME,
    title: REPORT_TITLE,
    periodLabel: buildSubtitle(meta),
    columns: xlsxColumns,
    rows,
    summaryItems: [
      { label: "Total Qualifiers", value: rows.length },
      { label: "Elementary", value: elemCount },
      { label: "Junior High", value: jhsCount },
      { label: "Senior High", value: shsCount },
    ],
  });
}
