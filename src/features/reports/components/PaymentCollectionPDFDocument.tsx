import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type {
  PaymentCollectionRow,
  PaymentCollectionSummary,
} from "../payment-collection-report.types";
import { PAYMENT_METHOD_LABELS } from "../payment-collection-report.types";

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
    marginBottom: 2,
  },
  generatedAt: {
    fontSize: 8,
    color: "#888",
  },
  summarySection: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#666",
  },
  summaryValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#333",
  },
  methodBreakdown: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  methodItem: {
    width: "20%",
    marginBottom: 4,
  },
  methodLabel: {
    fontSize: 8,
    color: "#888",
  },
  methodValue: {
    fontSize: 9,
    fontWeight: "bold",
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#333",
    color: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },
  // Column widths (percentages) - portrait layout with reduced columns
  colOr: { width: "14%" },
  colDate: { width: "14%" },
  colStudent: { width: "32%" },
  colGrade: { width: "14%" },
  colAmount: { width: "16%", textAlign: "right" as const },
  colMethod: { width: "10%" },
  headerCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#fff",
  },
  cell: {
    fontSize: 8,
    color: "#333",
  },
  cellMono: {
    fontSize: 7,
    fontFamily: "Courier",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 8,
  },
  pageNumber: {
    fontSize: 8,
    color: "#888",
  },
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaymentCollectionPDFDocumentProps {
  rows: PaymentCollectionRow[];
  summary: PaymentCollectionSummary;
  generatedAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  // Use explicit PHP text to avoid font rendering issues (± appearing instead of ₱)
  const formatted = amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `PHP ${formatted}`;
}

function formatDatePDF(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(date));
}

function formatDateTimePDF(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(date));
}

const ROWS_PER_PAGE = 30;

// ─── Document Function ───────────────────────────────────────────────────────

export function PaymentCollectionPDFDocument({
  rows,
  summary,
  generatedAt,
}: PaymentCollectionPDFDocumentProps): ReactElement<DocumentProps> {
  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE) || 1;
  const pages: PaymentCollectionRow[][] = [];

  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    pages.push(rows.slice(i, i + ROWS_PER_PAGE));
  }

  // If no rows, still show one page with summary
  if (pages.length === 0) {
    pages.push([]);
  }

  return (
    <Document>
      {pages.map((pageRows, pageIndex) => (
        <Page
          key={pageIndex}
          size="A4"
          orientation="portrait"
          style={styles.page}
        >
          {/* Header - only on first page */}
          {pageIndex === 0 && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>
                  SRAMS - Payment Collection Report
                </Text>
                <Text style={styles.subtitle}>
                  Period: {formatDatePDF(summary.periodStart)} -{" "}
                  {formatDatePDF(summary.periodEnd)}
                </Text>
                <Text style={styles.generatedAt}>
                  Generated: {formatDateTimePDF(generatedAt)}
                </Text>
              </View>

              {/* Summary Section */}
              <View style={styles.summarySection}>
                <Text style={styles.summaryTitle}>Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Payments:</Text>
                  <Text style={styles.summaryValue}>{summary.totalCount}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Amount:</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(summary.totalAmount)}
                  </Text>
                </View>

                {/* Method Breakdown */}
                <View style={styles.methodBreakdown}>
                  <View style={styles.methodItem}>
                    <Text style={styles.methodLabel}>Cash</Text>
                    <Text style={styles.methodValue}>
                      {formatCurrency(summary.byMethod.cash)}
                    </Text>
                  </View>
                  <View style={styles.methodItem}>
                    <Text style={styles.methodLabel}>GCash</Text>
                    <Text style={styles.methodValue}>
                      {formatCurrency(summary.byMethod.gcash)}
                    </Text>
                  </View>
                  <View style={styles.methodItem}>
                    <Text style={styles.methodLabel}>Bank Transfer</Text>
                    <Text style={styles.methodValue}>
                      {formatCurrency(summary.byMethod.bank_transfer)}
                    </Text>
                  </View>
                  <View style={styles.methodItem}>
                    <Text style={styles.methodLabel}>Check</Text>
                    <Text style={styles.methodValue}>
                      {formatCurrency(summary.byMethod.check)}
                    </Text>
                  </View>
                  <View style={styles.methodItem}>
                    <Text style={styles.methodLabel}>Other</Text>
                    <Text style={styles.methodValue}>
                      {formatCurrency(summary.byMethod.other)}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Table */}
          <View style={styles.table}>
            {/* Table Header - reduced columns for portrait layout */}
            <View style={styles.tableHeader}>
              <View style={styles.colOr}>
                <Text style={styles.headerCell}>OR #</Text>
              </View>
              <View style={styles.colDate}>
                <Text style={styles.headerCell}>Date</Text>
              </View>
              <View style={styles.colStudent}>
                <Text style={styles.headerCell}>Student</Text>
              </View>
              <View style={styles.colGrade}>
                <Text style={styles.headerCell}>Grade</Text>
              </View>
              <View style={styles.colAmount}>
                <Text style={styles.headerCell}>Amount</Text>
              </View>
              <View style={styles.colMethod}>
                <Text style={styles.headerCell}>Method</Text>
              </View>
            </View>

            {/* Table Rows - reduced columns for portrait layout */}
            {pageRows.map((row, rowIndex) => (
              <View
                key={row.id}
                style={[
                  styles.tableRow,
                  rowIndex % 2 === 1 ? styles.tableRowAlt : {},
                ]}
              >
                <View style={styles.colOr}>
                  <Text style={styles.cellMono}>{row.orNumber || "—"}</Text>
                </View>
                <View style={styles.colDate}>
                  <Text style={styles.cell}>
                    {formatDatePDF(row.collectionDate)}
                  </Text>
                </View>
                <View style={styles.colStudent}>
                  <Text style={styles.cell}>{row.studentName}</Text>
                  <Text style={[styles.cell, { fontSize: 7, color: "#888" }]}>
                    {row.studentRef}
                  </Text>
                </View>
                <View style={styles.colGrade}>
                  <Text style={styles.cell}>{row.gradeLevel}</Text>
                </View>
                <View style={styles.colAmount}>
                  <Text style={[styles.cell, { textAlign: "right" }]}>
                    {formatCurrency(Number(row.amount))}
                  </Text>
                </View>
                <View style={styles.colMethod}>
                  <Text style={styles.cell}>
                    {PAYMENT_METHOD_LABELS[row.paymentMethod] ||
                      row.paymentMethod}
                  </Text>
                </View>
              </View>
            ))}

            {/* Empty state */}
            {pageRows.length === 0 && (
              <View style={[styles.tableRow, { justifyContent: "center" }]}>
                <Text style={[styles.cell, { color: "#888" }]}>
                  No payments found for the selected period.
                </Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.pageNumber}>
              SRAMS Payment Collection Report
            </Text>
            <Text style={styles.pageNumber}>
              Page {pageIndex + 1} of {totalPages}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
