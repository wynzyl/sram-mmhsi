import "server-only";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import {
  type ReportColumn,
  type ReportSummaryItem,
  SCHOOL_NAME,
  SCHOOL_ADDRESS,
} from "./shared/pdf-primitives";
import type { XlsxColumn } from "./shared/xlsx-report";
import {
  pesoText,
  pesoNumber,
  PESO_NUMBER_FORMAT,
  reportDate,
  reportDateTime,
} from "./shared/report-format";
import { REPORT_FONT_FAMILY, registerReportFonts } from "./shared/pdf-fonts";
import { BRAND_MARK, PRINT, BRAND_MARK_ARGB } from "@/lib/brand";
import type {
  AccountsReceivableRow,
  AccountsReceivableGrouped,
  AccountsReceivableSummary,
} from "./accounts-receivable-report.queries";

/**
 * Accounts Receivable report — both export tracks.
 *
 * Per-student outstanding balances grouped by grade level with totals.
 * Track 1 (PDF) and Track 2 (XLSX) share the row→cell logic here.
 */

const REPORT_TITLE = "Accounts Receivable Report";
const SHEET_NAME = "Accounts Receivable";

export interface AccountsReceivableReportMeta {
  schoolYearLabel: string;
  gradeLevelLabel?: string;
}

function buildSubtitle(meta: AccountsReceivableReportMeta): string {
  const parts = [`School Year ${meta.schoolYearLabel}`];
  if (meta.gradeLevelLabel) {
    parts.push(meta.gradeLevelLabel);
  }
  parts.push("Outstanding");
  return parts.join(" · ");
}

function buildSummaryItems(
  summary: AccountsReceivableSummary,
): ReportSummaryItem[] {
  return [
    { label: "Total Accounts", value: String(summary.totalAccounts) },
    { label: "Total Assessed", value: pesoText(summary.totalAssessed) },
    { label: "Total Paid", value: pesoText(summary.totalPaid) },
    {
      label: "Total Outstanding",
      value: pesoText(summary.totalOutstanding),
      emphasis: true,
    },
  ];
}

// ─── PDF Styles ─────────────────────────────────────────────────────────────

const BRAND_RED = BRAND_MARK;
const INK = PRINT.ink;
const MUTED = PRINT.muted;
const LINE = PRINT.line;

const styles = StyleSheet.create({
  page: {
    padding: 30,
    paddingBottom: 46,
    fontSize: 9,
    fontFamily: REPORT_FONT_FAMILY,
    color: INK,
  },
  header: {
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: BRAND_RED,
    paddingBottom: 10,
  },
  school: {
    fontSize: 13,
    fontWeight: "bold",
    color: BRAND_RED,
    marginBottom: 2,
  },
  address: { fontSize: 8, color: MUTED, marginBottom: 8 },
  title: { fontSize: 15, fontWeight: "bold", color: INK, marginBottom: 3 },
  subtitle: { fontSize: 9, color: MUTED, marginBottom: 1 },
  generatedAt: { fontSize: 8, color: "#888888" },

  summary: {
    marginBottom: 14,
    padding: 10,
    backgroundColor: "#faf8f5",
    borderLeftWidth: 3,
    borderLeftColor: BRAND_RED,
  },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap" },
  summaryItem: { width: "25%", marginBottom: 6, paddingRight: 8 },
  summaryLabel: { fontSize: 8, color: MUTED, marginBottom: 2 },
  summaryValue: { fontSize: 11, fontWeight: "bold", color: INK },
  summaryValueEmphasis: { fontSize: 11, fontWeight: "bold", color: PRINT.emphasis },

  gradeLevelHeader: {
    flexDirection: "row",
    backgroundColor: "#e8e5e0",
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  gradeLevelText: {
    fontSize: 10,
    fontWeight: "bold",
    color: INK,
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#333333",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  headerCell: { fontSize: 8, fontWeight: "bold", color: "#ffffff" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  cell: { fontSize: 8, color: INK },
  cellMono: { fontSize: 7.5, fontFamily: "Courier" },
  cellRight: { textAlign: "right" },

  subtotalRow: {
    flexDirection: "row",
    backgroundColor: "#f0ede8",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
  },
  subtotalLabel: { fontSize: 8, fontWeight: "bold", color: INK },
  subtotalValue: { fontSize: 8, fontWeight: "bold", color: INK, textAlign: "right" },

  grandTotalRow: {
    flexDirection: "row",
    backgroundColor: "#333333",
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 12,
  },
  grandTotalLabel: { fontSize: 9, fontWeight: "bold", color: "#ffffff" },
  grandTotalValue: { fontSize: 9, fontWeight: "bold", color: "#ffffff", textAlign: "right" },

  empty: { paddingVertical: 16, textAlign: "center", fontSize: 9, color: "#888888" },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 6,
  },
  footerText: { fontSize: 8, color: "#888888" },
});

// Column widths as percentages (landscape A4)
const COL_WIDTHS = {
  studentId: "10%",
  studentName: "22%",
  schoolYear: "10%",
  totalAssessed: "13%",
  amountPaid: "13%",
  balance: "12%",
  lastOr: "10%",
  orDate: "10%",
};

// ─── PDF (Track 1) - Grouped ─────────────────────────────────────────────────

export function AccountsReceivableGroupedPdfDocument({
  groups,
  summary,
  meta,
  generatedAt,
}: {
  groups: AccountsReceivableGrouped[];
  summary: AccountsReceivableSummary;
  meta: AccountsReceivableReportMeta;
  generatedAt: Date;
}): ReactElement<DocumentProps> {
  registerReportFonts();

  const summaryItems = buildSummaryItems(summary);

  return (
    <Document title={REPORT_TITLE}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.school}>{SCHOOL_NAME}</Text>
          <Text style={styles.address}>{SCHOOL_ADDRESS}</Text>
          <Text style={styles.title}>{REPORT_TITLE}</Text>
          <Text style={styles.subtitle}>{buildSubtitle(meta)}</Text>
          <Text style={styles.generatedAt}>
            Generated: {reportDateTime(generatedAt)}
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryGrid}>
            {summaryItems.map((item) => (
              <View key={item.label} style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text
                  style={
                    item.emphasis
                      ? styles.summaryValueEmphasis
                      : styles.summaryValue
                  }
                >
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Empty state */}
        {groups.length === 0 && (
          <Text style={styles.empty}>
            No outstanding balances found for the selected filters.
          </Text>
        )}

        {/* Grouped data */}
        {groups.map((group) => (
          <View key={group.gradeLevelId} wrap={false}>
            {/* Grade Level Header */}
            <View style={styles.gradeLevelHeader}>
              <Text style={styles.gradeLevelText}>
                {group.gradeLevelName} ({group.subtotal.studentCount} student{group.subtotal.studentCount !== 1 ? "s" : ""})
              </Text>
            </View>

            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={{ width: COL_WIDTHS.studentId, paddingRight: 4 }}>
                <Text style={styles.headerCell}>Student ID</Text>
              </View>
              <View style={{ width: COL_WIDTHS.studentName, paddingRight: 4 }}>
                <Text style={styles.headerCell}>Student Name</Text>
              </View>
              <View style={{ width: COL_WIDTHS.schoolYear, paddingRight: 4 }}>
                <Text style={styles.headerCell}>School Year</Text>
              </View>
              <View style={{ width: COL_WIDTHS.totalAssessed, paddingRight: 4 }}>
                <Text style={[styles.headerCell, styles.cellRight]}>Total Assessed</Text>
              </View>
              <View style={{ width: COL_WIDTHS.amountPaid, paddingRight: 4 }}>
                <Text style={[styles.headerCell, styles.cellRight]}>Amount Paid</Text>
              </View>
              <View style={{ width: COL_WIDTHS.balance, paddingRight: 4 }}>
                <Text style={[styles.headerCell, styles.cellRight]}>Balance</Text>
              </View>
              <View style={{ width: COL_WIDTHS.lastOr, paddingRight: 4 }}>
                <Text style={styles.headerCell}>Last OR#</Text>
              </View>
              <View style={{ width: COL_WIDTHS.orDate, paddingRight: 4 }}>
                <Text style={[styles.headerCell, styles.cellRight]}>OR Date</Text>
              </View>
            </View>

            {/* Data rows */}
            {group.rows.map((row, idx) => (
              <View
                key={row.studentId}
                style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <View style={{ width: COL_WIDTHS.studentId, paddingRight: 4 }}>
                  <Text style={styles.cellMono}>{row.studentRef}</Text>
                </View>
                <View style={{ width: COL_WIDTHS.studentName, paddingRight: 4 }}>
                  <Text style={styles.cell}>{row.studentName}</Text>
                </View>
                <View style={{ width: COL_WIDTHS.schoolYear, paddingRight: 4 }}>
                  <Text style={styles.cell}>{row.schoolYearLabel}</Text>
                </View>
                <View style={{ width: COL_WIDTHS.totalAssessed, paddingRight: 4 }}>
                  <Text style={[styles.cell, styles.cellRight]}>{pesoText(row.totalAmount)}</Text>
                </View>
                <View style={{ width: COL_WIDTHS.amountPaid, paddingRight: 4 }}>
                  <Text style={[styles.cell, styles.cellRight]}>{pesoText(row.totalPaid)}</Text>
                </View>
                <View style={{ width: COL_WIDTHS.balance, paddingRight: 4 }}>
                  <Text style={[styles.cell, styles.cellRight]}>{pesoText(row.balance)}</Text>
                </View>
                <View style={{ width: COL_WIDTHS.lastOr, paddingRight: 4 }}>
                  <Text style={styles.cellMono}>{row.lastOrNumber ?? "—"}</Text>
                </View>
                <View style={{ width: COL_WIDTHS.orDate, paddingRight: 4 }}>
                  <Text style={[styles.cell, styles.cellRight]}>{reportDate(row.orDate)}</Text>
                </View>
              </View>
            ))}

            {/* Subtotal row */}
            <View style={styles.subtotalRow} wrap={false}>
              <View style={{ width: COL_WIDTHS.studentId, paddingRight: 4 }} />
              <View style={{ width: COL_WIDTHS.studentName, paddingRight: 4 }}>
                <Text style={styles.subtotalLabel}>Subtotal ({group.gradeLevelName})</Text>
              </View>
              <View style={{ width: COL_WIDTHS.schoolYear, paddingRight: 4 }} />
              <View style={{ width: COL_WIDTHS.totalAssessed, paddingRight: 4 }}>
                <Text style={styles.subtotalValue}>{pesoText(group.subtotal.totalAmount)}</Text>
              </View>
              <View style={{ width: COL_WIDTHS.amountPaid, paddingRight: 4 }}>
                <Text style={styles.subtotalValue}>{pesoText(group.subtotal.totalPaid)}</Text>
              </View>
              <View style={{ width: COL_WIDTHS.balance, paddingRight: 4 }}>
                <Text style={styles.subtotalValue}>{pesoText(group.subtotal.totalBalance)}</Text>
              </View>
              <View style={{ width: COL_WIDTHS.lastOr, paddingRight: 4 }} />
              <View style={{ width: COL_WIDTHS.orDate, paddingRight: 4 }} />
            </View>
          </View>
        ))}

        {/* Grand Total */}
        {groups.length > 0 && (
          <View style={styles.grandTotalRow} wrap={false}>
            <View style={{ width: COL_WIDTHS.studentId, paddingRight: 4 }} />
            <View style={{ width: COL_WIDTHS.studentName, paddingRight: 4 }}>
              <Text style={styles.grandTotalLabel}>GRAND TOTAL ({summary.totalAccounts} students)</Text>
            </View>
            <View style={{ width: COL_WIDTHS.schoolYear, paddingRight: 4 }} />
            <View style={{ width: COL_WIDTHS.totalAssessed, paddingRight: 4 }}>
              <Text style={styles.grandTotalValue}>{pesoText(summary.totalAssessed)}</Text>
            </View>
            <View style={{ width: COL_WIDTHS.amountPaid, paddingRight: 4 }}>
              <Text style={styles.grandTotalValue}>{pesoText(summary.totalPaid)}</Text>
            </View>
            <View style={{ width: COL_WIDTHS.balance, paddingRight: 4 }}>
              <Text style={styles.grandTotalValue}>{pesoText(summary.totalOutstanding)}</Text>
            </View>
            <View style={{ width: COL_WIDTHS.lastOr, paddingRight: 4 }} />
            <View style={{ width: COL_WIDTHS.orDate, paddingRight: 4 }} />
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{REPORT_TITLE}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

// ─── XLSX (Track 2) - Grouped ────────────────────────────────────────────────

const HEADER_FILL = "FF333333";
const BRAND_RED_ARGB = BRAND_MARK_ARGB;
const SUBTOTAL_FILL = "FFF0EDE8";
const GRADE_HEADER_FILL = "FFE8E5E0";

export async function buildAccountsReceivableGroupedXlsx(
  groups: AccountsReceivableGrouped[],
  summary: AccountsReceivableSummary,
  meta: AccountsReceivableReportMeta,
): Promise<Buffer> {
  const generatedAt = new Date();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SRAMS";
  workbook.created = generatedAt;

  const sheet = workbook.addWorksheet(SHEET_NAME.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 0 }],
  });

  // Column config: Student ID, Student Name, School Year, Total Assessed, Amount Paid, Balance, Last OR#, OR Date
  const colWidths = [14, 28, 12, 16, 16, 16, 14, 12];
  colWidths.forEach((w, idx) => {
    sheet.getColumn(idx + 1).width = w;
  });
  const lastCol = 8;
  const lastColLetter = "H";

  // Title row
  const titleRow = sheet.addRow([REPORT_TITLE]);
  sheet.mergeCells(`A${titleRow.number}:${lastColLetter}${titleRow.number}`);
  titleRow.getCell(1).font = { size: 14, bold: true, color: { argb: BRAND_RED_ARGB } };

  // Subtitle row
  const subtitleRow = sheet.addRow([buildSubtitle(meta)]);
  sheet.mergeCells(`A${subtitleRow.number}:${lastColLetter}${subtitleRow.number}`);
  subtitleRow.getCell(1).font = { size: 9, color: { argb: "FF888888" } };

  // Generated row
  const genRow = sheet.addRow([`Generated: ${reportDateTime(generatedAt)}`]);
  sheet.mergeCells(`A${genRow.number}:${lastColLetter}${genRow.number}`);
  genRow.getCell(1).font = { size: 9, color: { argb: "FF888888" } };

  sheet.addRow([]); // spacer

  // Summary row
  const summaryRow = sheet.addRow([
    `Total Accounts: ${summary.totalAccounts}`,
    "",
    `Total Assessed: ${pesoText(summary.totalAssessed)}`,
    "",
    `Total Paid: ${pesoText(summary.totalPaid)}`,
    "",
    `Outstanding: ${pesoText(summary.totalOutstanding)}`,
    "",
  ]);
  summaryRow.eachCell((cell) => {
    cell.font = { bold: true };
  });

  sheet.addRow([]); // spacer

  // For each grade level group
  for (const group of groups) {
    // Grade level header
    const gradeRow = sheet.addRow([
      `${group.gradeLevelName} (${group.subtotal.studentCount} student${group.subtotal.studentCount !== 1 ? "s" : ""})`,
    ]);
    sheet.mergeCells(`A${gradeRow.number}:${lastColLetter}${gradeRow.number}`);
    gradeRow.getCell(1).font = { bold: true };
    gradeRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRADE_HEADER_FILL } };

    // Column headers
    const headerRow = sheet.addRow([
      "Student ID",
      "Student Name",
      "School Year",
      "Total Assessed",
      "Amount Paid",
      "Balance",
      "Last OR#",
      "OR Date",
    ]);
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      cell.alignment = { vertical: "middle", horizontal: colNumber >= 4 && colNumber <= 6 ? "right" : "left" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFBBBBBB" } } };
    });

    // Data rows
    for (const row of group.rows) {
      const dataRow = sheet.addRow([
        row.studentRef,
        row.studentName,
        row.schoolYearLabel,
        pesoNumber(row.totalAmount),
        pesoNumber(row.totalPaid),
        pesoNumber(row.balance),
        row.lastOrNumber ?? "—",
        row.orDate ? reportDate(row.orDate) : "—",
      ]);
      // Format currency columns (4, 5, 6)
      dataRow.getCell(4).numFmt = PESO_NUMBER_FORMAT;
      dataRow.getCell(4).alignment = { horizontal: "right" };
      dataRow.getCell(5).numFmt = PESO_NUMBER_FORMAT;
      dataRow.getCell(5).alignment = { horizontal: "right" };
      dataRow.getCell(6).numFmt = PESO_NUMBER_FORMAT;
      dataRow.getCell(6).alignment = { horizontal: "right" };
      dataRow.getCell(8).alignment = { horizontal: "right" };
    }

    // Subtotal row
    const subtotalRow = sheet.addRow([
      "",
      `Subtotal (${group.gradeLevelName})`,
      "",
      pesoNumber(group.subtotal.totalAmount),
      pesoNumber(group.subtotal.totalPaid),
      pesoNumber(group.subtotal.totalBalance),
      "",
      "",
    ]);
    subtotalRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUBTOTAL_FILL } };
      if (colNumber >= 4 && colNumber <= 6) {
        cell.numFmt = PESO_NUMBER_FORMAT;
        cell.alignment = { horizontal: "right" };
      }
    });

    sheet.addRow([]); // spacer between groups
  }

  // Grand total row
  if (groups.length > 0) {
    const grandRow = sheet.addRow([
      "",
      `GRAND TOTAL (${summary.totalAccounts} students)`,
      "",
      pesoNumber(summary.totalAssessed),
      pesoNumber(summary.totalPaid),
      pesoNumber(summary.totalOutstanding),
      "",
      "",
    ]);
    grandRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      if (colNumber >= 4 && colNumber <= 6) {
        cell.numFmt = PESO_NUMBER_FORMAT;
        cell.alignment = { horizontal: "right" };
      }
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

// ─── Legacy exports for backwards compatibility ─────────────────────────────

const pdfColumns: ReportColumn<AccountsReceivableRow>[] = [
  { header: "Student ID", width: "10%", mono: true, cell: (r) => r.studentRef },
  { header: "Student Name", width: "22%", cell: (r) => r.studentName },
  { header: "School Year", width: "10%", cell: (r) => r.schoolYearLabel },
  {
    header: "Total Assessed",
    width: "13%",
    align: "right",
    cell: (r) => pesoText(r.totalAmount),
  },
  {
    header: "Amount Paid",
    width: "13%",
    align: "right",
    cell: (r) => pesoText(r.totalPaid),
  },
  {
    header: "Balance",
    width: "12%",
    align: "right",
    cell: (r) => pesoText(r.balance),
  },
  { header: "Last OR#", width: "10%", mono: true, cell: (r) => r.lastOrNumber ?? "—" },
  {
    header: "OR Date",
    width: "10%",
    align: "right",
    cell: (r) => reportDate(r.orDate),
  },
];

const xlsxColumns: XlsxColumn<AccountsReceivableRow>[] = [
  { header: "Student ID", width: 14, value: (r) => r.studentRef },
  { header: "Student Name", width: 28, value: (r) => r.studentName },
  { header: "School Year", width: 12, value: (r) => r.schoolYearLabel },
  {
    header: "Total Assessed",
    width: 16,
    align: "right",
    numFmt: PESO_NUMBER_FORMAT,
    value: (r) => pesoNumber(r.totalAmount),
  },
  {
    header: "Amount Paid",
    width: 16,
    align: "right",
    numFmt: PESO_NUMBER_FORMAT,
    value: (r) => pesoNumber(r.totalPaid),
  },
  {
    header: "Balance",
    width: 16,
    align: "right",
    numFmt: PESO_NUMBER_FORMAT,
    value: (r) => pesoNumber(r.balance),
  },
  { header: "Last OR#", width: 14, value: (r) => r.lastOrNumber ?? "—" },
  {
    header: "OR Date",
    width: 12,
    align: "right",
    value: (r) => reportDate(r.orDate),
  },
];

// Export for potential future use
export { pdfColumns, xlsxColumns };
