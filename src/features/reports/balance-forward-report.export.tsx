import "server-only";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import {
  TabularReportDocument,
  type ReportColumn,
  type ReportSummaryItem,
} from "./shared/pdf-primitives";
import { buildReportWorkbook, type XlsxColumn } from "./shared/xlsx-report";
import {
  pesoText,
  pesoNumber,
  PESO_NUMBER_FORMAT,
  reportDate,
  reportPeriodLabel,
} from "./shared/report-format";
import type {
  BfxTransferRow,
  BfxReportSummary,
} from "./balance-forward-report.queries";

/**
 * Balance Forward (BFX) report — both export tracks.
 *
 * BFX receipts record balance transfers carried from a prior school year.
 * Track 1 (PDF) and Track 2 (XLSX) share the row→cell logic here.
 */

const REPORT_TITLE = "Balance Forward Transfers";
const REPORT_SUBTITLE =
  "BFX receipts — balance transfers from prior school years";
const SHEET_NAME = "Balance Forwards";

function buildSummaryItems(summary: BfxReportSummary): ReportSummaryItem[] {
  return [
    { label: "Total Transfers", value: String(summary.totalTransfers) },
    { label: "Total Amount", value: pesoText(summary.totalAmount), emphasis: true },
  ];
}

// ─── PDF (Track 1) ─────────────────────────────────────────────────────────────

function formatStudentName(r: BfxTransferRow): string {
  return r.isSpecialEducation ? `${r.studentName} (SPED)` : r.studentName;
}

const pdfColumns: ReportColumn<BfxTransferRow>[] = [
  { header: "BFX #", width: "15%", mono: true, cell: (r) => r.bfxNumber || "—" },
  { header: "Date", width: "13%", cell: (r) => reportDate(r.transferDate) },
  {
    header: "Student",
    width: "28%",
    cell: formatStudentName,
    subCell: (r) => r.studentRef,
  },
  { header: "Source SY", width: "13%", cell: (r) => r.sourceSchoolYearLabel },
  {
    header: "Amount",
    width: "16%",
    align: "right",
    cell: (r) => pesoText(r.amount),
  },
  { header: "Processed By", width: "15%", cell: (r) => r.createdBy ?? "System" },
];

export function BalanceForwardPdfDocument({
  rows,
  summary,
  generatedAt,
}: {
  rows: BfxTransferRow[];
  summary: BfxReportSummary;
  generatedAt: Date;
}): ReactElement<DocumentProps> {
  return (
    <TabularReportDocument
      title={REPORT_TITLE}
      subtitle={REPORT_SUBTITLE}
      periodLabel={reportPeriodLabel(summary.periodStart, summary.periodEnd)}
      generatedAt={generatedAt}
      summaryItems={buildSummaryItems(summary)}
      columns={pdfColumns}
      rows={rows}
      getRowKey={(r) => r.id}
      emptyMessage="No balance forward transfers found for the selected period."
    />
  );
}

// ─── XLSX (Track 2) ────────────────────────────────────────────────────────────

const xlsxColumns: XlsxColumn<BfxTransferRow>[] = [
  { header: "BFX #", width: 16, value: (r) => r.bfxNumber || "" },
  { header: "Date", width: 14, value: (r) => reportDate(r.transferDate) },
  { header: "Student", width: 28, value: formatStudentName },
  { header: "Student ID", width: 18, value: (r) => r.studentRef },
  { header: "Source School Year", width: 16, value: (r) => r.sourceSchoolYearLabel },
  {
    header: "Amount",
    width: 14,
    align: "right",
    numFmt: PESO_NUMBER_FORMAT,
    value: (r) => pesoNumber(r.amount),
  },
  { header: "Processed By", width: 16, value: (r) => r.createdBy ?? "System" },
  { header: "Remarks", width: 30, value: (r) => r.remarks ?? "" },
];

export function buildBalanceForwardXlsx(
  rows: BfxTransferRow[],
  summary: BfxReportSummary,
): Promise<Buffer> {
  return buildReportWorkbook({
    sheetName: SHEET_NAME,
    title: REPORT_TITLE,
    periodLabel: reportPeriodLabel(summary.periodStart, summary.periodEnd),
    columns: xlsxColumns,
    rows,
    summaryItems: [
      { label: "Total Transfers", value: summary.totalTransfers },
      { label: "Total Amount", value: summary.totalAmount, numFmt: PESO_NUMBER_FORMAT },
    ],
  });
}
