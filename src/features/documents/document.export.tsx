/**
 * Document Export Templates
 *
 * React-PDF document components for official school documents.
 * Each document type follows the established report standard using
 * shared primitives from src/features/reports/shared/.
 *
 * Document Types:
 * - Form 137 (Permanent Record)
 * - Form 138 (Report Card)
 * - Good Moral Certificate
 * - Certificate of Enrollment
 * - Certificate of Completion
 * - Diploma Copy
 */

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
  SCHOOL_ADDRESS,
} from "@/features/reports/shared/pdf-primitives";
import { reportLongDate } from "@/features/reports/shared/report-format";
import type { DocumentRequestType } from "@/lib/constants/document-requests";
import { DOCUMENT_REQUEST_TYPE_LABELS } from "@/lib/constants/document-requests";

// ─── Brand Colors ─────────────────────────────────────────────────────────────

const BRAND_RED = "#c70000";
const INK = "#1a1a1a";
const MUTED = "#666666";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentExportData {
  requestId: string;
  documentType: DocumentRequestType;
  documentNumber: string | null;
  studentName: string;
  studentReferenceNumber: string;
  gradeLevel: string | null;
  section: string | null;
  schoolYearLabel: string | null;
  purpose: string | null;
  releasedAt: Date | null;
  copies: number;
  /** For cert_enrollment: start/end dates */
  enrollmentStartDate?: Date | null;
  enrollmentEndDate?: Date | null;
  /** For form_138: quarterly grades */
  grades?: Array<{
    subject: string;
    q1: number | null;
    q2: number | null;
    q3: number | null;
    q4: number | null;
    final: number | null;
    remarks: string | null;
  }>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingVertical: 48,
    paddingHorizontal: 56,
    fontSize: 11,
    fontFamily: REPORT_FONT_FAMILY,
    color: INK,
  },
  accentTop: { height: 6, backgroundColor: BRAND_RED, marginBottom: 20 },

  // Title section
  titleSection: {
    textAlign: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
    color: INK,
  },
  subtitle: {
    fontSize: 10,
    color: MUTED,
  },

  // Document number
  documentNumber: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  docNumLabel: {
    fontSize: 9,
    color: MUTED,
  },
  docNumValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: INK,
  },

  // Student info box
  studentBox: {
    borderLeftWidth: 3,
    borderLeftColor: BRAND_RED,
    backgroundColor: "#faf8f5",
    padding: 14,
    marginBottom: 20,
  },
  detailRow: { flexDirection: "row", marginBottom: 4 },
  detailLabel: { width: 140, fontSize: 10, color: MUTED },
  detailValue: { fontSize: 11, fontWeight: "bold", color: INK, flex: 1 },

  // Body text
  bodyText: {
    fontSize: 11,
    lineHeight: 1.8,
    marginBottom: 12,
    textAlign: "justify",
    color: "#2a2a2a",
  },
  indent: {
    paddingLeft: 20,
  },

  // Certification statement
  certStatement: {
    marginTop: 20,
    marginBottom: 24,
    fontSize: 11,
    lineHeight: 1.8,
    textAlign: "justify",
    color: "#2a2a2a",
  },

  // Signature section
  signatureSection: {
    marginTop: 40,
    alignItems: "flex-end",
  },
  signatureBlock: {
    width: 200,
    alignItems: "center",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: INK,
    width: "100%",
    marginBottom: 6,
  },
  signatureName: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    color: INK,
  },
  signatureTitle: {
    fontSize: 9,
    color: MUTED,
    textAlign: "center",
  },

  // Purpose section
  purposeSection: {
    marginTop: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  purposeLabel: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 4,
  },
  purposeText: {
    fontSize: 10,
    fontStyle: "italic",
    color: INK,
  },

  // Grade table (Form 138)
  gradeTable: {
    marginVertical: 16,
    borderWidth: 0.5,
    borderColor: "#cccccc",
  },
  gradeHeader: {
    flexDirection: "row",
    backgroundColor: "#333333",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  gradeHeaderCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
  },
  gradeRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  gradeRowAlt: {
    backgroundColor: "#fafafa",
  },
  gradeCell: {
    fontSize: 8,
    color: INK,
    textAlign: "center",
  },
  gradeCellSubject: {
    fontSize: 8,
    color: INK,
    textAlign: "left",
    paddingLeft: 4,
  },

  // Footer
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

  // Date
  dateText: {
    textAlign: "right",
    fontSize: 10,
    color: MUTED,
    marginBottom: 20,
  },
});

// ─── Certificate of Good Moral Character ──────────────────────────────────────

function GoodMoralCertificate({
  data,
}: {
  data: DocumentExportData;
}): ReactElement<DocumentProps> {
  registerReportFonts();

  return (
    <Document title={`Good Moral Certificate - ${data.studentName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentTop} />
        <Letterhead />

        {data.documentNumber && (
          <View style={styles.documentNumber}>
            <Text style={styles.docNumLabel}>Document No.: </Text>
            <Text style={styles.docNumValue}>{data.documentNumber}</Text>
          </View>
        )}

        <View style={styles.titleSection}>
          <Text style={styles.title}>Certificate of Good Moral Character</Text>
        </View>

        <Text style={styles.bodyText}>TO WHOM IT MAY CONCERN:</Text>

        <Text style={styles.certStatement}>
          This is to certify that{" "}
          <Text style={{ fontWeight: "bold" }}>{data.studentName}</Text>, with
          Student ID{" "}
          <Text style={{ fontWeight: "bold" }}>{data.studentReferenceNumber}</Text>
          {data.gradeLevel && (
            <>
              , enrolled in{" "}
              <Text style={{ fontWeight: "bold" }}>{data.gradeLevel}</Text>
              {data.section && (
                <>
                  {" "}
                  Section{" "}
                  <Text style={{ fontWeight: "bold" }}>{data.section}</Text>
                </>
              )}
            </>
          )}
          {data.schoolYearLabel && (
            <>
              {" "}
              for School Year{" "}
              <Text style={{ fontWeight: "bold" }}>{data.schoolYearLabel}</Text>
            </>
          )}
          , is a student of good moral character. During their stay at{" "}
          {SCHOOL_NAME}, they have not been involved in any disciplinary case
          and have exhibited exemplary conduct befitting a student of this
          institution.
        </Text>

        <Text style={styles.bodyText}>
          This certification is being issued upon the request of the above-named
          student for{" "}
          <Text style={{ fontWeight: "bold" }}>
            {data.purpose || "whatever legal purpose it may serve"}
          </Text>
          .
        </Text>

        <Text style={styles.dateText}>
          Issued this {reportLongDate(data.releasedAt ?? new Date())} at{" "}
          {SCHOOL_ADDRESS}.
        </Text>

        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>School Registrar</Text>
            <Text style={styles.signatureTitle}>{SCHOOL_NAME}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {SCHOOL_NAME} · Official Document generated by SRAMS
        </Text>
        <View style={styles.accentBottom} fixed />
      </Page>
    </Document>
  );
}

// ─── Certificate of Enrollment ────────────────────────────────────────────────

function EnrollmentCertificate({
  data,
}: {
  data: DocumentExportData;
}): ReactElement<DocumentProps> {
  registerReportFonts();

  return (
    <Document title={`Certificate of Enrollment - ${data.studentName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentTop} />
        <Letterhead />

        {data.documentNumber && (
          <View style={styles.documentNumber}>
            <Text style={styles.docNumLabel}>Document No.: </Text>
            <Text style={styles.docNumValue}>{data.documentNumber}</Text>
          </View>
        )}

        <View style={styles.titleSection}>
          <Text style={styles.title}>Certificate of Enrollment</Text>
        </View>

        <Text style={styles.bodyText}>TO WHOM IT MAY CONCERN:</Text>

        <Text style={styles.certStatement}>
          This is to certify that{" "}
          <Text style={{ fontWeight: "bold" }}>{data.studentName}</Text>, with
          Student ID{" "}
          <Text style={{ fontWeight: "bold" }}>{data.studentReferenceNumber}</Text>
          , is officially enrolled at{" "}
          <Text style={{ fontWeight: "bold" }}>{SCHOOL_NAME}</Text>
          {data.gradeLevel && (
            <>
              {" "}
              in{" "}
              <Text style={{ fontWeight: "bold" }}>{data.gradeLevel}</Text>
              {data.section && (
                <>
                  {" "}
                  Section{" "}
                  <Text style={{ fontWeight: "bold" }}>{data.section}</Text>
                </>
              )}
            </>
          )}
          {data.schoolYearLabel && (
            <>
              {" "}
              for School Year{" "}
              <Text style={{ fontWeight: "bold" }}>{data.schoolYearLabel}</Text>
            </>
          )}
          .
        </Text>

        <Text style={styles.bodyText}>
          This certification is being issued upon the request of the above-named
          student for{" "}
          <Text style={{ fontWeight: "bold" }}>
            {data.purpose || "whatever legal purpose it may serve"}
          </Text>
          .
        </Text>

        <Text style={styles.dateText}>
          Issued this {reportLongDate(data.releasedAt ?? new Date())} at{" "}
          {SCHOOL_ADDRESS}.
        </Text>

        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>School Registrar</Text>
            <Text style={styles.signatureTitle}>{SCHOOL_NAME}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {SCHOOL_NAME} · Official Document generated by SRAMS
        </Text>
        <View style={styles.accentBottom} fixed />
      </Page>
    </Document>
  );
}

// ─── Certificate of Completion ────────────────────────────────────────────────

function CompletionCertificate({
  data,
}: {
  data: DocumentExportData;
}): ReactElement<DocumentProps> {
  registerReportFonts();

  return (
    <Document title={`Certificate of Completion - ${data.studentName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentTop} />
        <Letterhead />

        {data.documentNumber && (
          <View style={styles.documentNumber}>
            <Text style={styles.docNumLabel}>Document No.: </Text>
            <Text style={styles.docNumValue}>{data.documentNumber}</Text>
          </View>
        )}

        <View style={styles.titleSection}>
          <Text style={styles.title}>Certificate of Completion</Text>
        </View>

        <Text style={styles.bodyText}>TO WHOM IT MAY CONCERN:</Text>

        <Text style={styles.certStatement}>
          This is to certify that{" "}
          <Text style={{ fontWeight: "bold" }}>{data.studentName}</Text>, with
          Student ID{" "}
          <Text style={{ fontWeight: "bold" }}>{data.studentReferenceNumber}</Text>
          , has successfully completed the requirements of{" "}
          {data.gradeLevel ? (
            <Text style={{ fontWeight: "bold" }}>{data.gradeLevel}</Text>
          ) : (
            "their enrolled grade level"
          )}
          {data.schoolYearLabel && (
            <>
              {" "}
              for School Year{" "}
              <Text style={{ fontWeight: "bold" }}>{data.schoolYearLabel}</Text>
            </>
          )}{" "}
          at <Text style={{ fontWeight: "bold" }}>{SCHOOL_NAME}</Text>.
        </Text>

        <Text style={styles.bodyText}>
          This certification is being issued upon the request of the above-named
          student for{" "}
          <Text style={{ fontWeight: "bold" }}>
            {data.purpose || "whatever legal purpose it may serve"}
          </Text>
          .
        </Text>

        <Text style={styles.dateText}>
          Issued this {reportLongDate(data.releasedAt ?? new Date())} at{" "}
          {SCHOOL_ADDRESS}.
        </Text>

        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>School Registrar</Text>
            <Text style={styles.signatureTitle}>{SCHOOL_NAME}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {SCHOOL_NAME} · Official Document generated by SRAMS
        </Text>
        <View style={styles.accentBottom} fixed />
      </Page>
    </Document>
  );
}

// ─── Form 137 (Permanent Record) ──────────────────────────────────────────────

function Form137Document({
  data,
}: {
  data: DocumentExportData;
}): ReactElement<DocumentProps> {
  registerReportFonts();

  return (
    <Document title={`Form 137 - ${data.studentName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentTop} />
        <Letterhead />

        {data.documentNumber && (
          <View style={styles.documentNumber}>
            <Text style={styles.docNumLabel}>Document No.: </Text>
            <Text style={styles.docNumValue}>{data.documentNumber}</Text>
          </View>
        )}

        <View style={styles.titleSection}>
          <Text style={styles.title}>Form 137</Text>
          <Text style={styles.subtitle}>Permanent Record / School Record</Text>
        </View>

        <View style={styles.studentBox}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Student Name</Text>
            <Text style={styles.detailValue}>{data.studentName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Student ID</Text>
            <Text style={styles.detailValue}>{data.studentReferenceNumber}</Text>
          </View>
          {data.gradeLevel && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Grade Level</Text>
              <Text style={styles.detailValue}>
                {data.gradeLevel}
                {data.section && ` - ${data.section}`}
              </Text>
            </View>
          )}
          {data.schoolYearLabel && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>School Year</Text>
              <Text style={styles.detailValue}>{data.schoolYearLabel}</Text>
            </View>
          )}
        </View>

        <Text style={styles.bodyText}>
          This document serves as the official permanent record (Form 137) for
          the above-named student. The complete academic record including all
          subjects, grades, and credentials will be appended in the following
          pages.
        </Text>

        {data.purpose && (
          <View style={styles.purposeSection}>
            <Text style={styles.purposeLabel}>Purpose of Request:</Text>
            <Text style={styles.purposeText}>{data.purpose}</Text>
          </View>
        )}

        <Text style={styles.dateText}>
          Issued this {reportLongDate(data.releasedAt ?? new Date())} at{" "}
          {SCHOOL_ADDRESS}.
        </Text>

        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>School Registrar</Text>
            <Text style={styles.signatureTitle}>{SCHOOL_NAME}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {SCHOOL_NAME} · Form 137 (Permanent Record) generated by SRAMS
        </Text>
        <View style={styles.accentBottom} fixed />
      </Page>
    </Document>
  );
}

// ─── Form 138 (Report Card) ───────────────────────────────────────────────────

function Form138Document({
  data,
}: {
  data: DocumentExportData;
}): ReactElement<DocumentProps> {
  registerReportFonts();

  return (
    <Document title={`Form 138 - ${data.studentName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentTop} />
        <Letterhead />

        {data.documentNumber && (
          <View style={styles.documentNumber}>
            <Text style={styles.docNumLabel}>Document No.: </Text>
            <Text style={styles.docNumValue}>{data.documentNumber}</Text>
          </View>
        )}

        <View style={styles.titleSection}>
          <Text style={styles.title}>Form 138</Text>
          <Text style={styles.subtitle}>Report Card</Text>
        </View>

        <View style={styles.studentBox}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Student Name</Text>
            <Text style={styles.detailValue}>{data.studentName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Student ID</Text>
            <Text style={styles.detailValue}>{data.studentReferenceNumber}</Text>
          </View>
          {data.gradeLevel && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Grade Level</Text>
              <Text style={styles.detailValue}>
                {data.gradeLevel}
                {data.section && ` - ${data.section}`}
              </Text>
            </View>
          )}
          {data.schoolYearLabel && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>School Year</Text>
              <Text style={styles.detailValue}>{data.schoolYearLabel}</Text>
            </View>
          )}
        </View>

        {data.grades && data.grades.length > 0 && (
          <View style={styles.gradeTable}>
            <View style={styles.gradeHeader}>
              <View style={{ width: "30%" }}>
                <Text style={styles.gradeHeaderCell}>Subject</Text>
              </View>
              <View style={{ width: "12%" }}>
                <Text style={styles.gradeHeaderCell}>Q1</Text>
              </View>
              <View style={{ width: "12%" }}>
                <Text style={styles.gradeHeaderCell}>Q2</Text>
              </View>
              <View style={{ width: "12%" }}>
                <Text style={styles.gradeHeaderCell}>Q3</Text>
              </View>
              <View style={{ width: "12%" }}>
                <Text style={styles.gradeHeaderCell}>Q4</Text>
              </View>
              <View style={{ width: "12%" }}>
                <Text style={styles.gradeHeaderCell}>Final</Text>
              </View>
              <View style={{ width: "10%" }}>
                <Text style={styles.gradeHeaderCell}>Remarks</Text>
              </View>
            </View>
            {data.grades.map((grade, idx) => (
              <View
                key={grade.subject}
                style={[styles.gradeRow, idx % 2 === 1 ? styles.gradeRowAlt : {}]}
              >
                <View style={{ width: "30%" }}>
                  <Text style={styles.gradeCellSubject}>{grade.subject}</Text>
                </View>
                <View style={{ width: "12%" }}>
                  <Text style={styles.gradeCell}>{grade.q1 ?? "—"}</Text>
                </View>
                <View style={{ width: "12%" }}>
                  <Text style={styles.gradeCell}>{grade.q2 ?? "—"}</Text>
                </View>
                <View style={{ width: "12%" }}>
                  <Text style={styles.gradeCell}>{grade.q3 ?? "—"}</Text>
                </View>
                <View style={{ width: "12%" }}>
                  <Text style={styles.gradeCell}>{grade.q4 ?? "—"}</Text>
                </View>
                <View style={{ width: "12%" }}>
                  <Text style={styles.gradeCell}>{grade.final ?? "—"}</Text>
                </View>
                <View style={{ width: "10%" }}>
                  <Text style={styles.gradeCell}>{grade.remarks ?? "—"}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {(!data.grades || data.grades.length === 0) && (
          <Text style={styles.bodyText}>
            Grade records for this student will be appended to this document.
            Please contact the registrar&apos;s office for the complete academic
            record.
          </Text>
        )}

        {data.purpose && (
          <View style={styles.purposeSection}>
            <Text style={styles.purposeLabel}>Purpose of Request:</Text>
            <Text style={styles.purposeText}>{data.purpose}</Text>
          </View>
        )}

        <Text style={styles.dateText}>
          Issued this {reportLongDate(data.releasedAt ?? new Date())} at{" "}
          {SCHOOL_ADDRESS}.
        </Text>

        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>School Registrar</Text>
            <Text style={styles.signatureTitle}>{SCHOOL_NAME}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {SCHOOL_NAME} · Form 138 (Report Card) generated by SRAMS
        </Text>
        <View style={styles.accentBottom} fixed />
      </Page>
    </Document>
  );
}

// ─── Diploma Copy ─────────────────────────────────────────────────────────────

function DiplomaCopyDocument({
  data,
}: {
  data: DocumentExportData;
}): ReactElement<DocumentProps> {
  registerReportFonts();

  return (
    <Document title={`Diploma Copy - ${data.studentName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentTop} />
        <Letterhead />

        {data.documentNumber && (
          <View style={styles.documentNumber}>
            <Text style={styles.docNumLabel}>Document No.: </Text>
            <Text style={styles.docNumValue}>{data.documentNumber}</Text>
          </View>
        )}

        <View style={styles.titleSection}>
          <Text style={styles.title}>Certified True Copy</Text>
          <Text style={styles.subtitle}>Diploma</Text>
        </View>

        <Text style={styles.bodyText}>TO WHOM IT MAY CONCERN:</Text>

        <Text style={styles.certStatement}>
          This is to certify that{" "}
          <Text style={{ fontWeight: "bold" }}>{data.studentName}</Text>, with
          Student ID{" "}
          <Text style={{ fontWeight: "bold" }}>{data.studentReferenceNumber}</Text>
          , has successfully completed the requirements for graduation from{" "}
          <Text style={{ fontWeight: "bold" }}>{SCHOOL_NAME}</Text>
          {data.gradeLevel && (
            <>
              {" "}
              at the{" "}
              <Text style={{ fontWeight: "bold" }}>{data.gradeLevel}</Text> level
            </>
          )}
          {data.schoolYearLabel && (
            <>
              {" "}
              during School Year{" "}
              <Text style={{ fontWeight: "bold" }}>{data.schoolYearLabel}</Text>
            </>
          )}
          .
        </Text>

        <Text style={styles.bodyText}>
          This certified true copy of the diploma is being issued upon the
          request of the above-named graduate for{" "}
          <Text style={{ fontWeight: "bold" }}>
            {data.purpose || "whatever legal purpose it may serve"}
          </Text>
          .
        </Text>

        <Text style={styles.dateText}>
          Issued this {reportLongDate(data.releasedAt ?? new Date())} at{" "}
          {SCHOOL_ADDRESS}.
        </Text>

        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>School Registrar</Text>
            <Text style={styles.signatureTitle}>{SCHOOL_NAME}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {SCHOOL_NAME} · Diploma Copy generated by SRAMS
        </Text>
        <View style={styles.accentBottom} fixed />
      </Page>
    </Document>
  );
}

// ─── Other Document (Generic) ─────────────────────────────────────────────────

function OtherDocument({
  data,
}: {
  data: DocumentExportData;
}): ReactElement<DocumentProps> {
  registerReportFonts();

  return (
    <Document title={`Document - ${data.studentName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentTop} />
        <Letterhead />

        {data.documentNumber && (
          <View style={styles.documentNumber}>
            <Text style={styles.docNumLabel}>Document No.: </Text>
            <Text style={styles.docNumValue}>{data.documentNumber}</Text>
          </View>
        )}

        <View style={styles.titleSection}>
          <Text style={styles.title}>Official School Document</Text>
        </View>

        <View style={styles.studentBox}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Student Name</Text>
            <Text style={styles.detailValue}>{data.studentName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Student ID</Text>
            <Text style={styles.detailValue}>{data.studentReferenceNumber}</Text>
          </View>
          {data.gradeLevel && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Grade Level</Text>
              <Text style={styles.detailValue}>
                {data.gradeLevel}
                {data.section && ` - ${data.section}`}
              </Text>
            </View>
          )}
          {data.schoolYearLabel && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>School Year</Text>
              <Text style={styles.detailValue}>{data.schoolYearLabel}</Text>
            </View>
          )}
        </View>

        {data.purpose && (
          <View style={styles.purposeSection}>
            <Text style={styles.purposeLabel}>Purpose of Request:</Text>
            <Text style={styles.purposeText}>{data.purpose}</Text>
          </View>
        )}

        <Text style={styles.dateText}>
          Issued this {reportLongDate(data.releasedAt ?? new Date())} at{" "}
          {SCHOOL_ADDRESS}.
        </Text>

        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>School Registrar</Text>
            <Text style={styles.signatureTitle}>{SCHOOL_NAME}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {SCHOOL_NAME} · Official Document generated by SRAMS
        </Text>
        <View style={styles.accentBottom} fixed />
      </Page>
    </Document>
  );
}

// ─── Main Export Function ─────────────────────────────────────────────────────

/**
 * Generate the appropriate document based on type.
 * Call this from the route handler with data fetched from the database.
 */
export function generateDocument(
  data: DocumentExportData
): ReactElement<DocumentProps> {
  const docType = data.documentType;

  switch (docType) {
    case "form_137":
      return Form137Document({ data });
    case "form_138":
      return Form138Document({ data });
    case "good_moral":
      return GoodMoralCertificate({ data });
    case "cert_enrollment":
      return EnrollmentCertificate({ data });
    case "cert_completion":
      return CompletionCertificate({ data });
    case "diploma_copy":
      return DiplomaCopyDocument({ data });
    case "other":
    default:
      return OtherDocument({ data });
  }
}

/**
 * Get document title for filename generation.
 */
export function getDocumentFilename(data: DocumentExportData): string {
  const typeLabel = DOCUMENT_REQUEST_TYPE_LABELS[data.documentType]
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  const studentRef = data.studentReferenceNumber.replace(/[^a-zA-Z0-9]/g, "");
  const docNum = data.documentNumber?.replace(/[^a-zA-Z0-9]/g, "") ?? "draft";

  return `${typeLabel}-${studentRef}-${docNum}`;
}
