import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import {
  REPORT_FONT_FAMILY,
  registerReportFonts,
} from "@/features/reports/shared/pdf-fonts";
import {
  Letterhead,
  SCHOOL_NAME,
} from "@/features/reports/shared/pdf-primitives";
import { pesoText, reportLongDate } from "@/features/reports/shared/report-format";

/**
 * Official Assessment Invoice — Track 1 (react-pdf).
 *
 * Replaces the legacy HTML + `window.print()` route so the printed/downloaded
 * invoice is identical for every user. The email path still uses the HTML
 * template (`generateAssessmentLetterHtml`) — email clients need HTML.
 */

const BRAND_RED = "#c70000";
const INK = "#1a1a1a";
const MUTED = "#666666";

export interface InvoiceDocumentData {
  invoiceNumber: string;
  studentName: string;
  studentReferenceNumber: string;
  /** Original amount billed. */
  amountDue: string | number;
  /** Current outstanding balance (if assessment linked). */
  currentBalance?: string | number | null;
  date: Date;
}

const styles = StyleSheet.create({
  page: {
    paddingVertical: 48,
    paddingHorizontal: 56,
    fontSize: 11,
    fontFamily: REPORT_FONT_FAMILY,
    color: INK,
  },
  accentTop: { height: 6, backgroundColor: BRAND_RED, marginBottom: 20 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 10,
    color: "#333333",
    marginBottom: 22,
  },
  bold: { fontWeight: "bold" },
  title: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e0dbd4",
    paddingVertical: 10,
    marginBottom: 22,
  },
  paragraph: { fontSize: 11, lineHeight: 1.7, marginBottom: 12, color: "#2a2a2a" },
  salutation: { fontSize: 11, lineHeight: 1.7, marginBottom: 6, color: INK },
  studentBox: {
    borderLeftWidth: 3,
    borderLeftColor: BRAND_RED,
    backgroundColor: "#faf8f5",
    padding: 14,
    marginBottom: 18,
  },
  detailRow: { flexDirection: "row", marginBottom: 4 },
  detailLabel: { width: 130, fontSize: 10, color: MUTED },
  detailValue: { fontSize: 11, fontWeight: "bold", color: INK },
  amountBlock: {
    borderBottomWidth: 1,
    borderBottomColor: "#e0dbd4",
    borderStyle: "dashed",
    paddingBottom: 16,
    marginBottom: 18,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  amountLabel: { width: 150, fontSize: 10, color: MUTED },
  amountBilled: { fontSize: 14, fontWeight: "bold", color: INK },
  balanceDue: { fontSize: 20, fontWeight: "bold", color: BRAND_RED },
  balancePaid: { fontSize: 20, fontWeight: "bold", color: "#16a34a" },
  signature: { fontSize: 11, lineHeight: 1.6, marginTop: 24 },
  signatureName: { fontWeight: "bold", color: INK },
  signatureDept: { fontSize: 9, color: MUTED },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    textAlign: "center",
    fontSize: 8,
    color: "#999999",
    borderTopWidth: 1,
    borderTopColor: "#e0dbd4",
    paddingTop: 8,
  },
  accentBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: BRAND_RED,
  },
});

export function InvoiceDocument({
  data,
}: {
  data: InvoiceDocumentData;
}): ReactElement<DocumentProps> {
  registerReportFonts();

  const invoiceDisplay = data.invoiceNumber.replace(/^INV-/, "");
  const billed = Number(data.amountDue);
  const hasBalance =
    data.currentBalance !== null && data.currentBalance !== undefined;
  const balance = hasBalance ? Number(data.currentBalance) : billed;
  const fullyPaid = hasBalance && balance <= 0;

  return (
    <Document title={`Invoice ${invoiceDisplay}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentTop} />

        <Letterhead />

        <View style={styles.metaRow}>
          <Text>
            Invoice No.: <Text style={styles.bold}>{invoiceDisplay}</Text>
          </Text>
          <Text>
            Date: <Text style={styles.bold}>{reportLongDate(data.date)}</Text>
          </Text>
        </View>

        <Text style={styles.title}>Assessment Invoice</Text>

        <Text style={styles.salutation}>Dear Parent/Guardian,</Text>
        <Text style={styles.paragraph}>
          This is to inform you that the following student has been assessed for
          the amount due stated below:
        </Text>

        <View style={styles.studentBox}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Student Name</Text>
            <Text style={styles.detailValue}>{data.studentName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reference No.</Text>
            <Text style={styles.detailValue}>{data.studentReferenceNumber}</Text>
          </View>
        </View>

        <View style={styles.amountBlock}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Original Amount Billed</Text>
            <Text style={styles.amountBilled}>{pesoText(billed)}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Current Balance</Text>
            <Text style={fullyPaid ? styles.balancePaid : styles.balanceDue}>
              {pesoText(balance)}
              {fullyPaid ? "  (Fully Paid)" : ""}
            </Text>
          </View>
        </View>

        <Text style={styles.paragraph}>
          Please settle the above amount at the cashier&#39;s office. Kindly
          present this assessment invoice upon payment for proper verification
          and issuance of official receipt.
        </Text>
        <Text style={styles.paragraph}>Thank you.</Text>

        <View style={styles.signature}>
          <Text>Respectfully,</Text>
          <Text> </Text>
          <Text style={styles.signatureName}>Merryland Montessori</Text>
          <Text style={styles.signatureDept}>
            Accounting / Cashier Department
          </Text>
        </View>

        <Text style={styles.footer} fixed>
          {SCHOOL_NAME} · Official Assessment Invoice generated by SRAMS
        </Text>
        <View style={styles.accentBottom} fixed />
      </Page>
    </Document>
  );
}
