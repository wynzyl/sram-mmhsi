import "server-only";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import {
  TabularReportDocument,
  type ReportColumn,
  type ReportSummaryItem,
} from "./shared/pdf-primitives";
import {
  buildReportWorkbook,
  type XlsxColumn,
} from "./shared/xlsx-report";
import {
  pesoText,
  pesoNumber,
  PESO_NUMBER_FORMAT,
  reportDate,
  reportPeriodLabel,
} from "./shared/report-format";
import {
  PAYMENT_METHOD_LABELS,
  USAGE_MODE_LABELS,
  type PaymentCollectionRow,
  type PaymentCollectionSummary,
} from "./payment-collection-report.types";

/**
 * Payment Collection (General Payments) report — both export tracks.
 *
 * Track 1 (PDF) and Track 2 (XLSX) share the same row→cell logic here so the
 * two formats never drift. Consumed only by the export route handler.
 */

const REPORT_TITLE = "Payment Collection Report";
const SHEET_NAME = "Payment Collection";

function methodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

function modeLabel(mode: string | null): string {
  if (!mode) return "—";
  return USAGE_MODE_LABELS[mode] ?? mode;
}

function buildSummaryItems(
  summary: PaymentCollectionSummary,
): ReportSummaryItem[] {
  return [
    { label: "Total Payments", value: String(summary.totalCount) },
    { label: "Total Amount", value: pesoText(summary.totalAmount), emphasis: true },
    { label: "Cash", value: pesoText(summary.byMethod.cash) },
    { label: "GCash", value: pesoText(summary.byMethod.gcash) },
    { label: "Bank Transfer", value: pesoText(summary.byMethod.bank_transfer) },
    { label: "Check", value: pesoText(summary.byMethod.check) },
    { label: "Other", value: pesoText(summary.byMethod.other) },
  ];
}

// ─── PDF (Track 1) ─────────────────────────────────────────────────────────────

function formatStudentName(r: PaymentCollectionRow): string {
  return r.isSpecialEducation ? `${r.studentName} (SPED)` : r.studentName;
}

const pdfColumns: ReportColumn<PaymentCollectionRow>[] = [
  { header: "OR #", width: "12%", mono: true, cell: (r) => r.orNumber || "—" },
  { header: "Date", width: "11%", cell: (r) => reportDate(r.collectionDate) },
  {
    header: "Student",
    width: "24%",
    cell: formatStudentName,
    subCell: (r) => r.studentRef,
  },
  { header: "Grade", width: "10%", cell: (r) => r.gradeLevel },
  {
    header: "Amount",
    width: "11%",
    align: "right",
    cell: (r) => pesoText(r.amount),
  },
  { header: "Method", width: "11%", cell: (r) => methodLabel(r.paymentMethod) },
  { header: "Mode", width: "8%", align: "center", cell: (r) => modeLabel(r.usageMode) },
  { header: "Processed By", width: "13%", cell: (r) => r.processedBy },
];

export function PaymentCollectionPdfDocument({
  rows,
  summary,
  generatedAt,
}: {
  rows: PaymentCollectionRow[];
  summary: PaymentCollectionSummary;
  generatedAt: Date;
}): ReactElement<DocumentProps> {
  return (
    <TabularReportDocument
      title={REPORT_TITLE}
      periodLabel={reportPeriodLabel(summary.periodStart, summary.periodEnd)}
      generatedAt={generatedAt}
      summaryItems={buildSummaryItems(summary)}
      columns={pdfColumns}
      rows={rows}
      getRowKey={(r) => r.id}
      emptyMessage="No payments found for the selected period."
    />
  );
}

// ─── XLSX (Track 2) ────────────────────────────────────────────────────────────

const xlsxColumns: XlsxColumn<PaymentCollectionRow>[] = [
  { header: "OR #", width: 14, value: (r) => r.orNumber || "" },
  { header: "Date", width: 14, value: (r) => reportDate(r.collectionDate) },
  { header: "Student", width: 28, value: formatStudentName },
  { header: "Student ID", width: 18, value: (r) => r.studentRef },
  { header: "Grade", width: 12, value: (r) => r.gradeLevel },
  { header: "School Year", width: 12, value: (r) => r.schoolYear },
  {
    header: "Amount",
    width: 14,
    align: "right",
    numFmt: PESO_NUMBER_FORMAT,
    value: (r) => pesoNumber(r.amount),
  },
  { header: "Method", width: 14, value: (r) => methodLabel(r.paymentMethod) },
  { header: "Mode", width: 10, align: "center", value: (r) => modeLabel(r.usageMode) },
  { header: "Reference", width: 16, value: (r) => r.referenceNumber ?? "" },
  { header: "Processed By", width: 16, value: (r) => r.processedBy },
];

export function buildPaymentCollectionXlsx(
  rows: PaymentCollectionRow[],
  summary: PaymentCollectionSummary,
): Promise<Buffer> {
  return buildReportWorkbook({
    sheetName: SHEET_NAME,
    title: REPORT_TITLE,
    periodLabel: reportPeriodLabel(summary.periodStart, summary.periodEnd),
    columns: xlsxColumns,
    rows,
    summaryItems: [
      { label: "Total Payments", value: summary.totalCount },
      { label: "Total Amount", value: summary.totalAmount, numFmt: PESO_NUMBER_FORMAT },
      { label: "Cash", value: summary.byMethod.cash, numFmt: PESO_NUMBER_FORMAT },
      { label: "GCash", value: summary.byMethod.gcash, numFmt: PESO_NUMBER_FORMAT },
      {
        label: "Bank Transfer",
        value: summary.byMethod.bank_transfer,
        numFmt: PESO_NUMBER_FORMAT,
      },
      { label: "Check", value: summary.byMethod.check, numFmt: PESO_NUMBER_FORMAT },
      { label: "Other", value: summary.byMethod.other, numFmt: PESO_NUMBER_FORMAT },
    ],
  });
}
