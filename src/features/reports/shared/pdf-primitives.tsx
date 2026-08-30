import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";
import { REPORT_FONT_FAMILY, registerReportFonts } from "./pdf-fonts";
import { reportDateTime } from "./report-format";

// ─── Brand ───────────────────────────────────────────────────────────────────

import { BRAND_MARK, PRINT } from "@/lib/brand";

const BRAND_RED = BRAND_MARK; // letterhead only - see src/lib/brand.ts
const INK = PRINT.ink;
const MUTED = PRINT.muted;
const LINE = PRINT.line;

export const SCHOOL_NAME = "Merryland Montessori and High School Inc.";
export const SCHOOL_ADDRESS = "San Vicente, Urdaneta, Pangasinan";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReportAlign = "left" | "right" | "center";

export interface ReportColumn<T> {
  /** Column header label. */
  header: string;
  /** Width as a percentage string, e.g. "14%". Columns should sum to 100%. */
  width: string;
  align?: ReportAlign;
  /** Render monospaced (OR / reference numbers). */
  mono?: boolean;
  /** Primary cell text. */
  cell: (row: T) => string;
  /** Optional secondary line under the primary text (e.g. student ref). */
  subCell?: (row: T) => string | null;
}

export interface ReportSummaryItem {
  label: string;
  value: string;
  emphasis?: boolean;
}

interface TabularReportDocumentProps<T> {
  title: string;
  subtitle?: string;
  periodLabel?: string;
  generatedAt: Date;
  summaryItems?: ReportSummaryItem[];
  columns: ReportColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  footerText?: string;
  emptyMessage?: string;
  /** Rows on page 1 (leaves room for header + summary). Default 18. */
  firstPageRows?: number;
  /** Rows on subsequent pages. Default 28. */
  rowsPerPage?: number;
  orientation?: "portrait" | "landscape";
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  // Ink, not brand red: a money total is not a brand moment, and red on a
  // figure reads as an error.
  summaryValueEmphasis: { fontSize: 11, fontWeight: "bold", color: PRINT.emphasis },

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
  subCell: { fontSize: 7, color: "#888888" },
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

function alignStyle(align?: ReportAlign) {
  return { textAlign: (align ?? "left") as ReportAlign };
}

// ─── Reusable blocks ───────────────────────────────────────────────────────────

function TableHeaderRow<T>({ columns }: { columns: ReportColumn<T>[] }) {
  return (
    <View style={styles.tableHeader} fixed>
      {columns.map((col) => (
        <View key={col.header} style={{ width: col.width, paddingRight: 6 }}>
          <Text style={[styles.headerCell, alignStyle(col.align)]}>
            {col.header}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TableBodyRow<T>({
  row,
  columns,
  alt,
}: {
  row: T;
  columns: ReportColumn<T>[];
  alt: boolean;
}) {
  return (
    // wrap={false} keeps each row atomic so a row never splits across a page
    // boundary (which would leave an orphaned cell fragment on the next page).
    <View style={[styles.tableRow, alt ? styles.tableRowAlt : {}]} wrap={false}>
      {columns.map((col) => {
        const sub = col.subCell?.(row);
        return (
          <View key={col.header} style={{ width: col.width, paddingRight: 6 }}>
            <Text
              style={[
                col.mono ? styles.cellMono : styles.cell,
                alignStyle(col.align),
              ]}
            >
              {col.cell(row) || "—"}
            </Text>
            {sub ? (
              <Text style={[styles.subCell, alignStyle(col.align)]}>{sub}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** School letterhead block for official documents (invoices, receipts). */
export function Letterhead(): ReactElement {
  return (
    <View
      style={{
        textAlign: "center",
        borderBottomWidth: 1.5,
        borderBottomColor: BRAND_RED,
        paddingBottom: 10,
        marginBottom: 18,
      }}
    >
      <Text style={[styles.school, { fontSize: 15 }]}>{SCHOOL_NAME}</Text>
      <Text style={styles.address}>{SCHOOL_ADDRESS}</Text>
    </View>
  );
}

/** Bare A4 page wrapper with the standard fixed footer + page numbers. */
export function ReportPage({
  children,
  footerText,
  orientation = "portrait",
}: {
  children: ReactNode;
  footerText?: string;
  orientation?: "portrait" | "landscape";
}): ReactElement {
  return (
    <Page size="A4" orientation={orientation} style={styles.page}>
      {children}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>{footerText ?? SCHOOL_NAME}</Text>
        <Text
          style={styles.footerText}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
        />
      </View>
    </Page>
  );
}

// ─── Generic tabular report ────────────────────────────────────────────────────

/**
 * Generic paginated tabular report document.
 *
 * Track-1 official report renderer reused by every tabular report (Payment
 * Collection, Balance Forward, …). Header + summary render on page 1; the
 * table header repeats on every page; a fixed footer carries page numbers.
 */
export function TabularReportDocument<T>({
  title,
  subtitle,
  periodLabel,
  generatedAt,
  summaryItems,
  columns,
  rows,
  getRowKey,
  footerText,
  emptyMessage = "No records found for the selected filters.",
  firstPageRows = 18,
  rowsPerPage = 28,
  orientation = "portrait",
}: TabularReportDocumentProps<T>): ReactElement<DocumentProps> {
  registerReportFonts();

  // Chunk rows into pages (page 1 leaves room for header + summary).
  const pages: T[][] = [];
  if (rows.length === 0) {
    pages.push([]);
  } else {
    pages.push(rows.slice(0, firstPageRows));
    for (let i = firstPageRows; i < rows.length; i += rowsPerPage) {
      pages.push(rows.slice(i, i + rowsPerPage));
    }
  }

  return (
    <Document title={title}>
      {pages.map((pageRows, pageIndex) => (
        <Page
          key={pageIndex}
          size="A4"
          orientation={orientation}
          style={styles.page}
        >
          {pageIndex === 0 && (
            <>
              <View style={styles.header}>
                <Text style={styles.school}>{SCHOOL_NAME}</Text>
                <Text style={styles.address}>{SCHOOL_ADDRESS}</Text>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? (
                  <Text style={styles.subtitle}>{subtitle}</Text>
                ) : null}
                {periodLabel ? (
                  <Text style={styles.subtitle}>Period: {periodLabel}</Text>
                ) : null}
                <Text style={styles.generatedAt}>
                  Generated: {reportDateTime(generatedAt)}
                </Text>
              </View>

              {summaryItems && summaryItems.length > 0 ? (
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
              ) : null}
            </>
          )}

          <View>
            <TableHeaderRow columns={columns} />
            {pageRows.map((row, rowIndex) => (
              <TableBodyRow
                key={getRowKey(row)}
                row={row}
                columns={columns}
                alt={rowIndex % 2 === 1}
              />
            ))}
            {pageRows.length === 0 && (
              <Text style={styles.empty}>{emptyMessage}</Text>
            )}
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>{footerText ?? title}</Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
            />
          </View>
        </Page>
      ))}
    </Document>
  );
}
