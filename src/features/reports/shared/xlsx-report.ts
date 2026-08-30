import "server-only";
import ExcelJS from "exceljs";
import { reportDateTime } from "./report-format";

/**
 * Track-2 analytical report renderer.
 *
 * One generic workbook builder all spreadsheet exports call. Officers get a
 * native .xlsx they can pivot/total themselves. Currency columns are written
 * as real numbers with a peso number format so Excel can sum them.
 */

export type XlsxAlign = "left" | "right" | "center";

export interface XlsxColumn<T> {
  header: string;
  /** Column width in characters. Default 18. */
  width?: number;
  align?: XlsxAlign;
  /** Excel number format, e.g. PESO_NUMBER_FORMAT or "@" for text. */
  numFmt?: string;
  /** Cell value extractor. Return a number for sortable/summable columns. */
  value: (row: T) => string | number | Date | null;
}

export interface XlsxSummaryItem {
  label: string;
  value: string | number;
  numFmt?: string;
}

interface BuildWorkbookParams<T> {
  sheetName: string;
  title: string;
  periodLabel?: string;
  generatedAt?: Date;
  columns: XlsxColumn<T>[];
  rows: T[];
  summaryItems?: XlsxSummaryItem[];
}

const HEADER_FILL = "FF333333";
import { BRAND_MARK_ARGB } from "@/lib/brand";

const BRAND_RED = BRAND_MARK_ARGB; // title row only

export async function buildReportWorkbook<T>({
  sheetName,
  title,
  periodLabel,
  generatedAt = new Date(),
  columns,
  rows,
  summaryItems,
}: BuildWorkbookParams<T>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SRAMS";
  workbook.created = generatedAt;

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 0 }],
  });

  const lastCol = columns.length;
  const lastColLetter = sheet.getColumn(lastCol).letter;

  // Title row
  const titleRow = sheet.addRow([title]);
  sheet.mergeCells(`A${titleRow.number}:${lastColLetter}${titleRow.number}`);
  titleRow.getCell(1).font = { size: 14, bold: true, color: { argb: BRAND_RED } };

  // Period / generated row
  const metaParts = [
    periodLabel ? `Period: ${periodLabel}` : null,
    `Generated: ${reportDateTime(generatedAt)}`,
  ].filter(Boolean);
  const metaRow = sheet.addRow([metaParts.join("    ")]);
  sheet.mergeCells(`A${metaRow.number}:${lastColLetter}${metaRow.number}`);
  metaRow.getCell(1).font = { size: 9, color: { argb: "FF888888" } };

  sheet.addRow([]); // spacer

  // Header row
  const headerRow = sheet.addRow(columns.map((c) => c.header));
  const headerRowNumber = headerRow.number;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFBBBBBB" } } };
  });

  // Configure columns (width + per-column number format/alignment)
  columns.forEach((col, idx) => {
    const column = sheet.getColumn(idx + 1);
    column.width = col.width ?? 18;
  });

  // Data rows
  for (const row of rows) {
    const values = columns.map((col) => col.value(row));
    const dataRow = sheet.addRow(values);
    columns.forEach((col, idx) => {
      const cell = dataRow.getCell(idx + 1);
      if (col.numFmt) cell.numFmt = col.numFmt;
      if (col.align) cell.alignment = { horizontal: col.align };
    });
  }

  // Auto-filter over the header + data range
  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber + rows.length, column: lastCol },
    };
  }

  // Summary block
  if (summaryItems && summaryItems.length > 0) {
    sheet.addRow([]);
    for (const item of summaryItems) {
      const sRow = sheet.addRow([item.label, item.value]);
      sRow.getCell(1).font = { bold: true };
      if (item.numFmt) sRow.getCell(2).numFmt = item.numFmt;
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}
