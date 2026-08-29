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
} from "./shared/report-format";
import type {
  AccountsReceivableRow,
  AccountsReceivableSummary,
} from "./accounts-receivable-report.queries";

/**
 * Accounts Receivable report — both export tracks.
 *
 * Per-student outstanding balances for a school year (or all years), with the
 * last payment date and aging in days. Track 1 (PDF) and Track 2 (XLSX) share
 * the row→cell logic here so the two formats never drift.
 */

const REPORT_TITLE = "Accounts Receivable Report";
const SHEET_NAME = "Accounts Receivable";

export interface AccountsReceivableReportMeta {
  schoolYearLabel: string; // "All School Years" or a specific year label
}

function buildSubtitle(meta: AccountsReceivableReportMeta): string {
  return `School Year ${meta.schoolYearLabel} · Outstanding`;
}

function buildSummaryItems(
  summary: AccountsReceivableSummary,
): ReportSummaryItem[] {
  return [
    { label: "Total Accounts", value: String(summary.totalAccounts) },
    {
      label: "Total Outstanding",
      value: pesoText(summary.totalOutstanding),
      emphasis: true,
    },
  ];
}

// ─── PDF (Track 1) ─────────────────────────────────────────────────────────────

function formatStudentName(r: AccountsReceivableRow): string {
  const suffixes: string[] = [];
  if (r.hasEscDiscount) suffixes.push("ESC");
  if (r.isSpecialEducation) suffixes.push("SPED");
  return suffixes.length > 0
    ? `${r.studentName} (${suffixes.join(", ")})`
    : r.studentName;
}

const pdfColumns: ReportColumn<AccountsReceivableRow>[] = [
  { header: "Student ID", width: "13%", mono: true, cell: (r) => r.studentRef },
  { header: "Student Name", width: "30%", cell: formatStudentName },
  { header: "School Year", width: "15%", cell: (r) => r.schoolYearLabel },
  {
    header: "Balance",
    width: "16%",
    align: "right",
    cell: (r) => pesoText(r.balance),
  },
  {
    header: "Last Payment",
    width: "15%",
    align: "right",
    cell: (r) => reportDate(r.lastPaymentDate),
  },
  {
    header: "Aging (Days)",
    width: "11%",
    align: "right",
    cell: (r) => String(r.agingDays),
  },
];

export function AccountsReceivablePdfDocument({
  rows,
  summary,
  meta,
  generatedAt,
}: {
  rows: AccountsReceivableRow[];
  summary: AccountsReceivableSummary;
  meta: AccountsReceivableReportMeta;
  generatedAt: Date;
}): ReactElement<DocumentProps> {
  return (
    <TabularReportDocument
      title={REPORT_TITLE}
      subtitle={buildSubtitle(meta)}
      generatedAt={generatedAt}
      summaryItems={buildSummaryItems(summary)}
      columns={pdfColumns}
      rows={rows}
      getRowKey={(r) => `${r.studentId}-${r.schoolYearLabel}`}
      emptyMessage="No outstanding balances found for the selected filters."
    />
  );
}

// ─── XLSX (Track 2) ────────────────────────────────────────────────────────────

const xlsxColumns: XlsxColumn<AccountsReceivableRow>[] = [
  { header: "Student ID", width: 14, value: (r) => r.studentRef },
  { header: "Student Name", width: 30, value: formatStudentName },
  { header: "School Year", width: 14, value: (r) => r.schoolYearLabel },
  {
    header: "Balance",
    width: 16,
    align: "right",
    numFmt: PESO_NUMBER_FORMAT,
    value: (r) => pesoNumber(r.balance),
  },
  {
    header: "Last Payment",
    width: 16,
    align: "right",
    value: (r) => reportDate(r.lastPaymentDate),
  },
  {
    header: "Aging (Days)",
    width: 14,
    align: "right",
    value: (r) => r.agingDays,
  },
];

export function buildAccountsReceivableXlsx(
  rows: AccountsReceivableRow[],
  summary: AccountsReceivableSummary,
  meta: AccountsReceivableReportMeta,
): Promise<Buffer> {
  return buildReportWorkbook({
    sheetName: SHEET_NAME,
    title: REPORT_TITLE,
    periodLabel: buildSubtitle(meta),
    columns: xlsxColumns,
    rows,
    summaryItems: [
      { label: "Total Accounts", value: summary.totalAccounts },
      {
        label: "Total Outstanding",
        value: summary.totalOutstanding,
        numFmt: PESO_NUMBER_FORMAT,
      },
    ],
  });
}
